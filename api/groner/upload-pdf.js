import { handleUploadPdf } from '../../lib/groner/handlers/upload-pdf.js';

export default handleUploadPdf;

export const config = {
  api: {
    bodyParser: false,
  },
};
