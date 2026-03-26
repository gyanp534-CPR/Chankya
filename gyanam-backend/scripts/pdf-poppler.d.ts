declare module "pdf-poppler" {
  const pdfPoppler: {
    convert(file: string, options: {
      format: string;
      out_dir: string;
      out_prefix: string;
      page: number | null;
    }): Promise<unknown>;
    info(file: string): Promise<unknown>;
    path: string;
  };

  export default pdfPoppler;
}
