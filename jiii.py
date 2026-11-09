from pdf2docx import Converter

def convert_pdf_to_word(pdf_path, docx_path):
    cv = Converter(pdf_path)
    cv.convert(docx_path)
    cv.close()

# Example usage
convert_pdf_to_word(r"D:\LProjects\NostalgicAI-main\Internship_Report_Budigi_Venkata_Sahithi_Updated.pdf", 'output.docx')

