#!/usr/bin/env python3
"""Synchronously upload and process all PDFs in the uploads directory."""

import argparse
import sys
import time
from pathlib import Path

project_root = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(project_root))

from app.services.documents import get_document_service


def get_pdf_files(uploads_dir: Path) -> list[Path]:
    """Return all PDFs in the uploads directory, sorted by name."""
    return sorted(
        path for path in uploads_dir.iterdir()
        if path.is_file() and path.suffix.lower() == ".pdf"
    )


def upload_single_pdf(file_path: Path) -> bool:
    """Upload and process a single PDF synchronously."""
    service = get_document_service()
    start_time = time.time()
    file_size_mb = file_path.stat().st_size / (1024 * 1024)

    print("=" * 60)
    print(f"Uploading: {file_path.name}")
    print("=" * 60)
    print(f"Path: {file_path}")
    print(f"Size: {file_size_mb:.2f} MB")
    print("Mode: synchronous")
    print()

    try:
        result = service.upload_document(str(file_path))
    except Exception as exc:
        print(f"✗ Failed: {exc}")
        print()
        return False

    duration = time.time() - start_time
    print("✓ Completed")
    print(f"  Document: {result['document_name']}")
    print(f"  Chunks: {result['chunks_processed']}")
    print(f"  Storage path: {result['storage_path']}")
    if result.get("public_url"):
        print(f"  Public URL: {result['public_url']}")
    print(f"  Duration: {duration:.1f}s")
    print()
    return True


def parse_args() -> argparse.Namespace:
    """Parse CLI arguments."""
    parser = argparse.ArgumentParser(
        description="Upload and process all PDFs in the uploads directory, one at a time."
    )
    parser.add_argument(
        "--uploads-dir",
        default=str(project_root / "uploads"),
        help="Directory containing PDFs to upload",
    )
    parser.add_argument(
        "--yes",
        action="store_true",
        help="Skip the confirmation prompt",
    )
    parser.add_argument(
        "--stop-on-error",
        action="store_true",
        help="Stop immediately if one PDF fails",
    )
    return parser.parse_args()


def main() -> int:
    """Upload all PDFs from the uploads directory sequentially."""
    args = parse_args()
    uploads_dir = Path(args.uploads_dir).resolve()

    if not uploads_dir.exists():
        print(f"Error: uploads directory not found: {uploads_dir}")
        return 1

    pdf_files = get_pdf_files(uploads_dir)
    if not pdf_files:
        print(f"No PDF files found in {uploads_dir}")
        return 0

    print("=" * 60)
    print("Upload All PDFs")
    print("=" * 60)
    print(f"Uploads directory: {uploads_dir}")
    print(f"Total PDFs found: {len(pdf_files)}")
    print("Behavior: each PDF is uploaded and fully processed before the next starts")
    print()

    for index, pdf_path in enumerate(pdf_files, start=1):
        size_mb = pdf_path.stat().st_size / (1024 * 1024)
        print(f"  {index:2d}. {pdf_path.name} ({size_mb:.2f} MB)")

    print()
    if not args.yes:
        response = input("Proceed with synchronous upload? (y/n): ").strip().lower()
        if response != "y":
            print("Upload cancelled.")
            return 0

    successful = 0
    failed = 0

    for index, pdf_path in enumerate(pdf_files, start=1):
        print(f"[{index}/{len(pdf_files)}]")
        if upload_single_pdf(pdf_path):
            successful += 1
            continue

        failed += 1
        if args.stop_on_error:
            print("Stopping because --stop-on-error was set.")
            break

    print("=" * 60)
    print("Summary")
    print("=" * 60)
    print(f"Successful: {successful}")
    print(f"Failed: {failed}")
    print(f"Total attempted: {successful + failed}")

    return 0 if failed == 0 else 1


if __name__ == "__main__":
    raise SystemExit(main())
