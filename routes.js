const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const requestIp = require('request-ip');

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1500,
  message: "Muitas requisições foram feitas a partir deste IP. Tente novamente mais tarde.",
  keyGenerator: (req) => {
    return requestIp.getClientIp(req);
  },
});

const usuarioRoutes = require('./routes/usuarioRoutes');


router.use('/usuarios', limiter, usuarioRoutes);


module.exports = router;

