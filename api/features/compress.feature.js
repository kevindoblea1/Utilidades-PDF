// api/features/compress.feature.js
module.exports = ({ express, UPLOAD_DIR, getUploader, storage }) => {
  const router = require('../compress')({
    upload: getUploader('pdf', storage),
    UPLOAD_DIR
  });
  return { name: 'compress', path: '/api/compress', router };
};
