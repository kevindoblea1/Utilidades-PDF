// api/features/docx2excel.feature.js
module.exports = ({ express, UPLOAD_DIR, getUploader, storage }) => {
  const router = require('../docx2excel')({
    upload: getUploader('docx', storage),
    UPLOAD_DIR
  });
  return { name: 'docx2excel', path: '/api/docx2excel', router };
};
