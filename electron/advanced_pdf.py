import sys
import os
import warnings

# Suppress PyMuPDF deprecation notice
warnings.filterwarnings('ignore', category=UserWarning)
warnings.filterwarnings('ignore', category=DeprecationWarning)
os.environ['PYTHONWARNINGS'] = 'ignore'

import fitz # PyMuPDF
import tempfile

def split_pdf(input_path, output_dir=None):
    if not output_dir:
        output_dir = os.path.dirname(input_path)
    base = os.path.splitext(os.path.basename(input_path))[0]
    doc = fitz.open(input_path)
    out_files = []
    for i in range(len(doc)):
        new_doc = fitz.open()
        new_doc.insert_pdf(doc, from_page=i, to_page=i, links=True, annots=True)
        page_path = os.path.join(output_dir, f"{base}_page_{i+1}.pdf")
        new_doc.save(page_path, garbage=4, deflate=True)
        new_doc.close()
        out_files.append(page_path)
    doc.close()
    return out_files[0] if out_files else input_path

def merge_pdf(input_files, output_path):
    doc = fitz.open()
    for f in input_files:
        if os.path.exists(f):
            try:
                sub = fitz.open(f)
                doc.insert_pdf(sub, links=True, annots=True)
                sub.close()
            except Exception as e:
                print(f"Warning: could not merge {f}: {e}", file=sys.stderr)
    doc.save(output_path, garbage=4, deflate=True)
    doc.close()
    return output_path

def compress_pdf(input_path, output_path):
    doc = fitz.open(input_path)
    # 1. High-fidelity image optimization (same as iLovePDF standard compression)
    try:
        import io
        from PIL import Image
        for page in doc:
            for img in page.get_images(full=True):
                xref = img[0]
                try:
                    base_img = doc.extract_image(xref)
                    img_bytes = base_img["image"]
                    im = Image.open(io.BytesIO(img_bytes))
                    # If image is very large (> 2000px), downsample to 1800px max
                    max_dim = 1800
                    if im.width > max_dim or im.height > max_dim:
                        im.thumbnail((max_dim, max_dim), Image.Resampling.LANCZOS)
                    if im.mode in ('RGBA', 'P'):
                        im = im.convert('RGB')
                    buf = io.BytesIO()
                    im.save(buf, format='JPEG', quality=82, optimize=True)
                    doc.update_stream(xref, buf.getvalue())
                except Exception:
                    pass
    except Exception:
        pass

    # 2. Re-compact objects and deflate streams
    doc.save(output_path, garbage=4, deflate=True, clean=True, linear=True)
    doc.close()
    return output_path

def pdf_to_jpg(input_path, output_dir=None):
    if not output_dir:
        output_dir = os.path.dirname(input_path)
    base = os.path.splitext(os.path.basename(input_path))[0]
    doc = fitz.open(input_path)
    images = []
    for i in range(len(doc)):
        page = doc[i]
        # 300 DPI for crystal clear print-quality images
        pix = page.get_pixmap(dpi=300)
        img_path = os.path.join(output_dir, f"{base}_page_{i+1}.jpg")
        pix.save(img_path)
        images.append(img_path)
    doc.close()
    return images[0] if images else input_path

def jpg_to_pdf(input_path, output_path):
    doc = fitz.open()
    img_doc = fitz.open(input_path)
    pdf_bytes = img_doc.convert_to_pdf()
    img_pdf = fitz.open("pdf", pdf_bytes)
    doc.insert_pdf(img_pdf)
    doc.save(output_path, garbage=4, deflate=True)
    doc.close()
    img_doc.close()
    return output_path

def pdf_to_ppt(input_path, output_path):
    from pptx import Presentation
    from pptx.util import Inches
    
    doc = fitz.open(input_path)
    prs = Presentation()
    
    # Match presentation aspect ratio to source PDF
    if len(doc) > 0:
        first_rect = doc[0].rect
        prs.slide_width = Inches(first_rect.width / 72.0)
        prs.slide_height = Inches(first_rect.height / 72.0)
    
    for i in range(len(doc)):
        page = doc[i]
        rect = page.rect
        width_in = rect.width / 72.0
        height_in = rect.height / 72.0
        
        blank_slide_layout = prs.slide_layouts[6] # Blank slide
        slide = prs.slides.add_slide(blank_slide_layout)
        
        # High resolution 300 DPI rendering for razor-sharp presentation slides
        pix = page.get_pixmap(dpi=300)
        temp_img = os.path.join(tempfile.gettempdir(), f"slide_{i}_{os.getpid()}.png")
        pix.save(temp_img)
        
        # Scale and center exactly within slide boundaries
        scale = min(prs.slide_width / Inches(width_in), prs.slide_height / Inches(height_in))
        final_w = Inches(width_in * scale)
        final_h = Inches(height_in * scale)
        left = (prs.slide_width - final_w) / 2
        top = (prs.slide_height - final_h) / 2
        
        slide.shapes.add_picture(temp_img, left, top, width=final_w, height=final_h)
        try:
            os.remove(temp_img)
        except Exception:
            pass
            
    prs.save(output_path)
    doc.close()
    return output_path

def pdf_to_excel(input_path, output_path):
    import pdfplumber
    import openpyxl
    from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
    
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "Extracted Data"
    ws.views.sheetView[0].showGridLines = True
    
    header_font = Font(name="Calibri", size=11, bold=True, color="1F2937")
    header_fill = PatternFill(start_color="F3F4F6", end_color="F3F4F6", fill_type="solid")
    data_font = Font(name="Calibri", size=11, color="111827")
    thin_border = Border(
        left=Side(style='thin', color='E5E7EB'),
        right=Side(style='thin', color='E5E7EB'),
        top=Side(style='thin', color='E5E7EB'),
        bottom=Side(style='thin', color='E5E7EB')
    )
    
    row_offset = 1
    found_any = False
    
    with pdfplumber.open(input_path) as pdf:
        for p_idx, page in enumerate(pdf.pages):
            # 1. Grid-based table extraction
            tables = page.extract_tables({
                "vertical_strategy": "lines",
                "horizontal_strategy": "lines",
                "snap_tolerance": 3,
                "join_tolerance": 3
            })
            
            # 2. Text-aligned strategy if no grid lines
            if not tables:
                tables = page.extract_tables({
                    "vertical_strategy": "text",
                    "horizontal_strategy": "text",
                    "snap_tolerance": 4,
                    "join_tolerance": 4
                })
                
            if tables:
                for t_idx, table in enumerate(tables):
                    found_any = True
                    if p_idx > 0 or t_idx > 0:
                        row_offset += 1
                        
                    is_first_row = True
                    for row in table:
                        if not any(row):
                            continue
                        for col_idx, cell in enumerate(row, 1):
                            val = (cell or "").strip()
                            # Attempt numeric conversion for accurate Excel calculations
                            num_val = None
                            if val:
                                try:
                                    clean_v = val.replace(',', '').replace('$', '').replace('€', '').strip()
                                    if '.' in clean_v:
                                        num_val = float(clean_v)
                                    else:
                                        num_val = int(clean_v)
                                except ValueError:
                                    pass
                            
                            c = ws.cell(row=row_offset, column=col_idx, value=num_val if num_val is not None else val)
                            c.border = thin_border
                            if is_first_row:
                                c.font = header_font
                                c.fill = header_fill
                                c.alignment = Alignment(horizontal="center" if num_val is not None else "left", vertical="center")
                            else:
                                c.font = data_font
                                c.alignment = Alignment(horizontal="right" if num_val is not None else "left", vertical="center")
                        row_offset += 1
                        is_first_row = False
            else:
                # Fallback: extract structured text lines
                text = page.extract_text()
                if text:
                    found_any = True
                    for line in text.split('\n'):
                        line = line.strip()
                        if not line:
                            continue
                        parts = line.split('\t') if '\t' in line else [p.strip() for p in line.split('   ') if p.strip()]
                        for col_idx, part in enumerate(parts, 1):
                            c = ws.cell(row=row_offset, column=col_idx, value=part)
                            c.font = data_font
                        row_offset += 1
                    row_offset += 1
    
    # Auto-fit column widths
    for col in ws.columns:
        max_len = 0
        col_letter = col[0].column_letter
        for cell in col:
            if cell.value is not None:
                max_len = max(max_len, len(str(cell.value)))
        ws.column_dimensions[col_letter].width = min(max(max_len + 3, 12), 65)

    wb.save(output_path)
    return output_path

def pdf_to_pdfa(input_path, output_path):
    doc = fitz.open(input_path)
    # Deflate streams and garbage clean for archival standard
    doc.save(output_path, deflate=True, garbage=4, clean=True)
    doc.close()
    return output_path

def html_to_pdf(input_path, output_path):
    with open(input_path, 'r', encoding='utf-8', errors='ignore') as f:
        html_content = f.read()
    
    doc = fitz.open()
    story = fitz.Story(html=html_content)
    writer = fitz.DocumentWriter(output_path)
    mediabox = fitz.paper_rect("letter")
    where = mediabox + (36, 36, -36, -36)
    
    more = 1
    while more:
        dev = writer.begin_page(mediabox)
        more, _ = story.place(where)
        story.draw(dev)
        writer.end_page()
    writer.close()
    return output_path

if __name__ == '__main__':
    if len(sys.argv) < 3:
        print("Usage: python advanced_pdf.py <action> <input_file> [output_file]", file=sys.stderr)
        sys.exit(1)
        
    action = sys.argv[1].lower().strip()
    input_file = sys.argv[2]
    output_file = sys.argv[3] if len(sys.argv) >= 4 else ""
    
    try:
        if action == 'split':
            out = split_pdf(input_file, os.path.dirname(input_file))
        elif action == 'merge':
            files = [f.strip() for f in input_file.split(',') if f.strip()]
            out = merge_pdf(files, output_file)
        elif action == 'compress':
            out = compress_pdf(input_file, output_file)
        elif action in ('pdf-to-jpg', 'jpg'):
            out = pdf_to_jpg(input_file, os.path.dirname(input_file))
        elif action == 'jpg-to-pdf':
            out = jpg_to_pdf(input_file, output_file)
        elif action in ('pdf-to-ppt', 'ppt', 'pptx'):
            out = pdf_to_ppt(input_file, output_file)
        elif action in ('pdf-to-excel', 'excel', 'xlsx'):
            out = pdf_to_excel(input_file, output_file)
        elif action in ('pdf-to-pdfa', 'pdfa'):
            out = pdf_to_pdfa(input_file, output_file)
        elif action == 'html-to-pdf':
            out = html_to_pdf(input_file, output_file)
        else:
            print(f"Unknown action: {action}", file=sys.stderr)
            sys.exit(1)
            
        print(f"SUCCESS:{out}")
        sys.exit(0)
    except Exception as e:
        print(f"ERROR:{str(e)}", file=sys.stderr)
        sys.exit(1)
