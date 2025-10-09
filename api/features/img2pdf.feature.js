// api/features/img2pdf.feature.js
module.exports = ({ express, UPLOAD_DIR, getUploader, storage }) => {
  const router = require('../img2pdf')({
    upload: getUploader('img', storage),
    UPLOAD_DIR
  });
  return { name: 'img2pdf', path: '/api/img2pdf', router };
};
