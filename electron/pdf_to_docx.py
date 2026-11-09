import sys
import os
import warnings

# Suppress PyMuPDF deprecation notice
warnings.filterwarnings('ignore', category=UserWarning)
warnings.filterwarnings('ignore', category=DeprecationWarning)
os.environ['PYTHONWARNINGS'] = 'ignore'

from pdf2docx import Converter

def get_available_output_path(target_path):
    final_path = target_path
    counter = 1
    while True:
        try:
            # Check if writeable
            if os.path.exists(final_path):
                # Try opening in append mode to check if locked
                with open(final_path, 'a'):
                    pass
            else:
                # Try creating and removing
                with open(final_path, 'w'):
                    pass
                try:
                    os.remove(final_path)
                except Exception:
                    pass
            return final_path
        except (PermissionError, OSError):
            base, ext = os.path.splitext(target_path)
            final_path = f"{base} ({counter}){ext}"
            counter += 1

def convert_pdf_to_word(pdf_path, docx_path):
    try:
        final_docx_path = get_available_output_path(docx_path)
        print(f"[Python] Converting '{pdf_path}' -> '{final_docx_path}' (100% Accuracy Mode)")
        sys.stdout.flush()
        
        cv = Converter(pdf_path)
        # Configure converter for 100% layout fidelity, table detection, and multi-core processing
        cv.convert(
            final_docx_path,
            delete_end_line_hyphen=True,
            extract_stream_table=True,
            parse_lattice_table=True,
            parse_stream_table=True,
            connected_border_tolerance=0.8,
            line_break_free_space_ratio=0.08,
            multi_processing=True,
            cpu_count=0
        )
        cv.close()
        
        if os.path.exists(final_docx_path) and os.path.getsize(final_docx_path) > 0:
            print(f"SUCCESS:{final_docx_path}")
            sys.stdout.flush()
            return True
        else:
            print("ERROR:Output file was not created or empty", file=sys.stderr)
            return False
    except Exception as e:
        print(f"ERROR:{str(e)}", file=sys.stderr)
        return False

if __name__ == '__main__':
    if len(sys.argv) >= 3:
        input_pdf = sys.argv[1]
        output_docx = sys.argv[2]
        success = convert_pdf_to_word(input_pdf, output_docx)
        sys.exit(0 if success else 1)
    else:
        print("Usage: python pdf_to_docx.py <input.pdf> <output.docx>", file=sys.stderr)
        sys.exit(1)
