"""Chat API endpoints."""

import json
from typing import Optional
from fastapi import APIRouter, HTTPException, Cookie, Depends, Response, Query
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from app.core.auth import AuthenticatedUser, get_current_user
from app.db.dependencies import get_supabase_client
from app.db.repository import get_document_repository
from app.services.rag.dependencies import get_rag_service
from app.services.chat import ChatSession, ChatMessage
from app.db.dependencies import get_redis_client


router = APIRouter(prefix="/chat", tags=["chat"])


class ChatRequest(BaseModel):
    """Chat request model."""
    message: str
    session_id: Optional[str] = None
    document_name: Optional[str] = None


class ChatResponse(BaseModel):
    """Chat response model."""
    session_id: str
    answer: str
    strategy: Optional[str] = None
    strategy_reasoning: Optional[str] = None
    sources: list = Field(default_factory=list)


class ChatSessionSummary(BaseModel):
    """Chat session summary for history sidebar."""

    session_id: str
    created_at: Optional[str] = None
    last_active: Optional[str] = None
    message_count: int = 0
    preview: str = "New Chat"


class ChatSessionListResponse(BaseModel):
    """List of chat sessions for the current user."""

    sessions: list[ChatSessionSummary] = Field(default_factory=list)


class ChatHistoryResponse(BaseModel):
    """Full message history for one chat session."""

    session_id: str
    messages: list = Field(default_factory=list)


def get_or_create_session(
    chat_session: ChatSession,
    user_id: str,
    cookie_session_id: Optional[str] = None,
    request_session_id: Optional[str] = None,
) -> str:
    """Resolve a user-owned session id or create a new session."""
    session_id = request_session_id or cookie_session_id
    if not session_id or not chat_session.session_exists(session_id, user_id=user_id):
        return chat_session.create_session(user_id=user_id)

    return session_id


@router.get("/documents")
async def list_chat_documents(
    current_user: AuthenticatedUser = Depends(get_current_user),
):
    """List documents available for chat document filtering."""
    supabase_client = get_supabase_client()
    doc_repo = get_document_repository(supabase_client)
    documents = doc_repo.list_documents()
    return {"documents": documents, "count": len(documents)}


@router.post("/send")
async def send_message(
    request: ChatRequest,
    response: Response,
    session_id: Optional[str] = Cookie(None),
    current_user: AuthenticatedUser = Depends(get_current_user),
) -> ChatResponse:
    """
    Send a chat message and get a response (non-streaming).

    Args:
        request: Chat request with message
        session_id: Session ID from cookie

    Returns:
        Chat response with answer and sources
    """
    # Initialize services
    redis_client = get_redis_client()
    chat_session = ChatSession(redis_client)
    rag_service = get_rag_service()

    # Get or create session
    session_id = get_or_create_session(
        chat_session,
        current_user.id,
        cookie_session_id=session_id,
        request_session_id=request.session_id,
    )
    response.set_cookie(key="session_id", value=session_id, httponly=True, samesite="lax", max_age=86400)

    # Add user message to history
    user_message = ChatMessage(role="user", content=request.message)
    chat_session.add_message(session_id, user_message, user_id=current_user.id)

    # Get RAG response
    result = rag_service.query(question=request.message, document_name=request.document_name)

    # Add assistant message to history
    assistant_message = ChatMessage(
        role="assistant",
        content=result["answer"],
        sources=result["sources"],
        strategy=result.get("strategy"),
        strategy_reasoning=result.get("strategy_reasoning")
    )
    chat_session.add_message(session_id, assistant_message, user_id=current_user.id)

    return ChatResponse(
        session_id=session_id,
        answer=result["answer"],
        strategy=result.get("strategy"),
        strategy_reasoning=result.get("strategy_reasoning"),
        sources=result["sources"]
    )


@router.get("/stream")
async def send_message_stream(
    message: str = Query(..., description="User message"),
    document_name: Optional[str] = Query(None, description="Optional document name to filter results"),
    session_id: Optional[str] = Cookie(None),
    request_session_id: Optional[str] = Query(None, alias="session_id", description="Explicit session ID"),
    current_user: AuthenticatedUser = Depends(get_current_user),
):
    """
    Send a chat message and get a streaming response with SSE.

    Args:
        message: User message (query parameter)
        document_name: Optional document name to filter results
        session_id: Session ID from cookie

    Returns:
        Server-Sent Events stream
    """
    # Initialize services
    redis_client = get_redis_client()
    chat_session = ChatSession(redis_client)
    rag_service = get_rag_service()

    # Get or create session
    session_id = get_or_create_session(
        chat_session,
        current_user.id,
        cookie_session_id=session_id,
        request_session_id=request_session_id,
    )

    # Add user message to history
    user_message = ChatMessage(role="user", content=message)
    chat_session.add_message(session_id, user_message, user_id=current_user.id)

    async def event_generator():
        """Generate SSE events."""
        full_answer = ""
        metadata = None

        try:
            # Stream RAG response
            async for chunk in rag_service.query_stream(question=message, document_name=document_name):
                if chunk["type"] == "token":
                    # Stream token
                    full_answer += chunk["content"]
                    yield f"data: {json.dumps({'type': 'token', 'content': chunk['content']})}\n\n"

                elif chunk["type"] == "metadata":
                    # Store metadata for later
                    metadata = chunk
                    # Send metadata and sources
                    payload = {
                        'type': 'metadata',
                        'strategy': chunk.get('strategy'),
                        'strategy_reasoning': chunk.get('strategy_reasoning'),
                        'sources': chunk.get('sources', [])
                    }
                    yield f"data: {json.dumps(payload)}\n\n"

            # Add assistant message to history
            assistant_message = ChatMessage(
                role="assistant",
                content=full_answer,
                sources=metadata.get("sources", []) if metadata else [],
                strategy=metadata.get("strategy") if metadata else None,
                strategy_reasoning=metadata.get("strategy_reasoning") if metadata else None
            )
            chat_session.add_message(session_id, assistant_message, user_id=current_user.id)

            # Send completion event
            yield f"data: {json.dumps({'type': 'done', 'session_id': session_id})}\n\n"

        except Exception as e:
            # Send error event
            yield f"data: {json.dumps({'type': 'error', 'message': str(e)})}\n\n"

    response = StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no"  # Disable nginx buffering
        }
    )
    response.set_cookie(key="session_id", value=session_id, httponly=True, samesite="lax", max_age=86400)
    return response


@router.get("/sessions", response_model=ChatSessionListResponse)
async def list_chat_sessions(
    current_user: AuthenticatedUser = Depends(get_current_user),
) -> ChatSessionListResponse:
    """List all chat sessions for the current user."""
    redis_client = get_redis_client()
    chat_session = ChatSession(redis_client)

    sessions = [
        ChatSessionSummary(**item)
        for item in chat_session.list_sessions(user_id=current_user.id)
    ]
    return ChatSessionListResponse(sessions=sessions)


@router.get("/history")
async def get_chat_history(
    request_session_id: Optional[str] = Query(None, alias="session_id"),
    session_id: Optional[str] = Cookie(None),
    limit: Optional[int] = 50,
    current_user: AuthenticatedUser = Depends(get_current_user),
):
    """
    Get chat history for a session.

    Args:
        session_id: Session ID from cookie
        limit: Maximum number of messages to return

    Returns:
        List of chat messages
    """
    resolved_session_id = request_session_id or session_id
    if not resolved_session_id:
        raise HTTPException(status_code=400, detail="No session ID provided")

    redis_client = get_redis_client()
    chat_session = ChatSession(redis_client)

    if not chat_session.session_exists(resolved_session_id, user_id=current_user.id):
        raise HTTPException(status_code=404, detail="Session not found")

    messages = chat_session.get_messages(resolved_session_id, limit=limit, user_id=current_user.id)

    return ChatHistoryResponse(
        session_id=resolved_session_id,
        messages=[msg.to_dict() for msg in messages],
    )


@router.post("/new")
async def new_chat_session(
    response: Response,
    current_user: AuthenticatedUser = Depends(get_current_user),
):
    """
    Create a new chat session.

    Args:
        response: FastAPI response for setting cookies
    Returns:
        New session ID
    """
    redis_client = get_redis_client()
    chat_session = ChatSession(redis_client)
    new_session_id = chat_session.create_session(user_id=current_user.id)

    # Set session cookie
    response.set_cookie(
        key="session_id",
        value=new_session_id,
        httponly=True,
        samesite="lax",
        max_age=86400  # 24 hours
    )

    return {"session_id": new_session_id}


@router.get("/stream/doc")
async def send_message_stream_with_docs(
    message: str = Query(..., description="User message"),
    doc_names: str = Query(..., description="Comma-separated list of document names to filter"),
    session_id: Optional[str] = Cookie(None),
    request_session_id: Optional[str] = Query(None, alias="session_id", description="Explicit session ID"),
    current_user: AuthenticatedUser = Depends(get_current_user),
):
    """
    Send a chat message with document filtering and get a streaming response with SSE.

    Args:
        message: User message (query parameter)
        doc_names: Comma-separated list of document names (e.g., "pdp8,PDP8_full-with-annexes_EN")
        session_id: Session ID from cookie

    Returns:
        Server-Sent Events stream
    """
    # Parse doc_names from comma-separated string to list of strings
    doc_names_list = [x.strip() for x in doc_names.split(",") if x.strip()]

    if not doc_names_list:
        raise HTTPException(status_code=400, detail="At least one document name must be provided.")

    # Initialize services
    redis_client = get_redis_client()
    chat_session = ChatSession(redis_client)
    rag_service = get_rag_service()

    # Get or create session
    session_id = get_or_create_session(
        chat_session,
        current_user.id,
        cookie_session_id=session_id,
        request_session_id=request_session_id,
    )

    # Add user message to history
    user_message = ChatMessage(role="user", content=message)
    chat_session.add_message(session_id, user_message, user_id=current_user.id)

    async def event_generator():
        """Generate SSE events."""
        full_answer = ""
        metadata = None

        try:
            # Stream RAG response with doc_ids filtering
            async for chunk in rag_service.query_stream(question=message, doc_names=doc_names_list):
                if chunk["type"] == "token":
                    # Stream token
                    full_answer += chunk["content"]
                    yield f"data: {json.dumps({'type': 'token', 'content': chunk['content']})}\n\n"

                elif chunk["type"] == "metadata":
                    # Store metadata for later
                    metadata = chunk
                    # Send metadata and sources
                    payload = {
                        'type': 'metadata',
                        'strategy': chunk.get('strategy'),
                        'strategy_reasoning': chunk.get('strategy_reasoning'),
                        'sources': chunk.get('sources', [])
                    }
                    yield f"data: {json.dumps(payload)}\n\n"

            # Add assistant message to history
            assistant_message = ChatMessage(
                role="assistant",
                content=full_answer,
                sources=metadata.get("sources", []) if metadata else [],
                strategy=metadata.get("strategy") if metadata else None,
                strategy_reasoning=metadata.get("strategy_reasoning") if metadata else None
            )
            chat_session.add_message(session_id, assistant_message, user_id=current_user.id)

            # Send completion event
            yield f"data: {json.dumps({'type': 'done', 'session_id': session_id})}\n\n"

        except Exception as e:
            # Send error event
            yield f"data: {json.dumps({'type': 'error', 'message': str(e)})}\n\n"

    response = StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no"  # Disable nginx buffering
        }
    )
    response.set_cookie(key="session_id", value=session_id, httponly=True, samesite="lax", max_age=86400)
    return response


@router.post("/send/doc")
async def send_message_with_docs(
    response: Response,
    message: str = Query(..., description="User message"),
    doc_names: str = Query(..., description="Comma-separated list of document names to filter"),
    session_id: Optional[str] = Cookie(None),
    current_user: AuthenticatedUser = Depends(get_current_user),
) -> ChatResponse:
    """
    Send a chat message with document filtering (non-streaming).

    Args:
        message: User message
        doc_names: Comma-separated list of document names (e.g., "pdp8,PDP8_full-with-annexes_EN")
        session_id: Session ID from cookie

    Returns:
        Chat response with answer and sources
    """
    # Parse doc_names from comma-separated string to list of strings
    doc_names_list = [x.strip() for x in doc_names.split(",") if x.strip()]

    if not doc_names_list:
        raise HTTPException(status_code=400, detail="At least one document name must be provided.")

    # Initialize services
    redis_client = get_redis_client()
    chat_session = ChatSession(redis_client)
    rag_service = get_rag_service()

    # Get or create session
    session_id = get_or_create_session(chat_session, current_user.id, cookie_session_id=session_id)
    response.set_cookie(key="session_id", value=session_id, httponly=True, samesite="lax", max_age=86400)

    # Add user message to history
    user_message = ChatMessage(role="user", content=message)
    chat_session.add_message(session_id, user_message, user_id=current_user.id)

    # Get RAG response with doc_ids filtering
    result = rag_service.query(question=message, doc_names=doc_names_list)

    # Add assistant message to history
    assistant_message = ChatMessage(
        role="assistant",
        content=result["answer"],
        sources=result["sources"],
        strategy=result.get("strategy"),
        strategy_reasoning=result.get("strategy_reasoning")
    )
    chat_session.add_message(session_id, assistant_message, user_id=current_user.id)

    return ChatResponse(
        session_id=session_id,
        answer=result["answer"],
        strategy=result.get("strategy"),
        strategy_reasoning=result.get("strategy_reasoning"),
        sources=result["sources"]
    )


@router.delete("/session")
async def delete_session(
    response: Response,
    request_session_id: Optional[str] = Query(None, alias="session_id"),
    session_id: Optional[str] = Cookie(None),
    current_user: AuthenticatedUser = Depends(get_current_user),
):
    """
    Delete a chat session.

    Args:
        response: FastAPI response for clearing cookies
        session_id: Session ID from cookie

    Returns:
        Success message
    """
    resolved_session_id = request_session_id or session_id
    if not resolved_session_id:
        raise HTTPException(status_code=400, detail="No session ID provided")

    redis_client = get_redis_client()
    chat_session = ChatSession(redis_client)

    if not chat_session.session_exists(resolved_session_id, user_id=current_user.id):
        raise HTTPException(status_code=404, detail="Session not found")

    chat_session.delete_session(resolved_session_id, user_id=current_user.id)

    # Clear session cookie
    if resolved_session_id == session_id:
        response.delete_cookie(key="session_id")

    return {"message": "Session deleted successfully"}
