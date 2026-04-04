"""Prompt templates and shared prompt rules."""

from .student_handbook import (
    STUDENT_HANDBOOK_FALLBACK_MESSAGE,
    STUDENT_HANDBOOK_SYSTEM_PROMPT_TEMPLATE,
    STUDENT_HANDBOOK_SYSTEM_RULES,
    DSPY_STUDENT_HANDBOOK_ANSWER_RULES,
    build_student_handbook_prompt,
)

__all__ = [
    "STUDENT_HANDBOOK_FALLBACK_MESSAGE",
    "STUDENT_HANDBOOK_SYSTEM_PROMPT_TEMPLATE",
    "STUDENT_HANDBOOK_SYSTEM_RULES",
    "DSPY_STUDENT_HANDBOOK_ANSWER_RULES",
    "build_student_handbook_prompt",
]
