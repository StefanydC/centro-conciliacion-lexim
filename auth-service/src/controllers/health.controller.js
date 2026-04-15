const health = (req, res) => {
  return res.status(200).json({
    mensaje: "auth-service funcionando",
    code: "OK"
  });
};

module.exports = { health };
