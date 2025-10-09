// api/features/pdf2word.feature.js
module.exports = ({ express, UPLOAD_DIR, getUploader, storage }) => {
  const router = require('../pdf2word')({
    upload: getUploader('pdf', storage),
    UPLOAD_DIR
  });
  return { name: 'pdf2word', path: '/api/pdf2word', router };
};
