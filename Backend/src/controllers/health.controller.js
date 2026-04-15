const health = (req, res) => {
  return res.status(200).json({
    mensaje: "backend funcionando",
    code: "OK"
  });
};

module.exports = { health };
