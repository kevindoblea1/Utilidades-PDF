// api/features/merge-two.feature.js
module.exports = ({ express, UPLOAD_DIR, getUploader, storage }) => {
  const router = require('../merge-two')({
    upload: getUploader('pdf', storage) // tu router ya usa PDFs
  });
  return { name: 'merge_two', path: '/api/merge-two', router };
};
