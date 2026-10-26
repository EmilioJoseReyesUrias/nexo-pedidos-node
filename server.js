'use strict';

const express = require('express');
const { Pool } = require('pg');
const path = require('node:path');
const { validarPedido, validarId } = require('./validacion');

if (!process.env.DATABASE_URL) {
  console.error('Falta DATABASE_URL. Configurala en Render como variable de entorno.');
  process.exit(1);
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 5,
  connectionTimeoutMillis: 12000,
  idleTimeoutMillis: 30000,
  // Si usas una conexion externa que obliga SSL, configura DB_SSL=true.
  ...(process.env.DB_SSL === 'true' ? { ssl: { rejectUnauthorized: true } } : {}),
});

pool.on('error', (error) => console.error('Conexion inactiva a PostgreSQL interrumpida:', error.message));

const app = express();
app.disable('x-powered-by');
app.use((_req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'no-referrer');
  next();
});
app.use(express.json({ limit: '16kb' }));
app.use(express.static(path.join(__dirname, 'public')));

app.get('/api', (_req, res) => res.json({
  servicio: 'Nexo Pedidos API',
  version: '1.0.0',
  endpoints: [
    'GET /api/salud', 'GET /api/pedidos', 'GET /api/pedidos/:id',
    'POST /api/pedidos', 'PUT /api/pedidos/:id', 'DELETE /api/pedidos/:id',
  ],
}));

app.get('/api/salud', async (_req, res, next) => {
  try {
    await pool.query('SELECT 1');
    res.json({ ok: true, aplicacion: 'node-express', base_datos: 'postgresql' });
  } catch (error) { next(error); }
});

app.get('/api/pedidos', async (_req, res, next) => {
  try {
    const result = await pool.query('SELECT id, cliente, concepto, total, estado, creado_en FROM pedidos ORDER BY id DESC LIMIT 500');
    res.json({ total: result.rowCount, datos: result.rows });
  } catch (error) { next(error); }
});

app.get('/api/pedidos/:id', async (req, res, next) => {
  const id = validarId(req.params.id);
  if (!id) return res.status(400).json({ error: 'Identificador no valido.' });
  try {
    const result = await pool.query('SELECT id, cliente, concepto, total, estado, creado_en FROM pedidos WHERE id=$1', [id]);
    if (!result.rowCount) return res.status(404).json({ error: 'Pedido no encontrado.' });
    res.json(result.rows[0]);
  } catch (error) { next(error); }
});

app.post('/api/pedidos', async (req, res, next) => {
  const result = validarPedido(req.body);
  if (result.error) return res.status(400).json({ error: result.error });
  const { cliente, concepto, total, estado } = result.value;
  try {
    const saved = await pool.query(
      'INSERT INTO pedidos (cliente, concepto, total, estado) VALUES ($1,$2,$3,$4) RETURNING id, cliente, concepto, total, estado, creado_en',
      [cliente, concepto, total, estado]
    );
    res.status(201).json(saved.rows[0]);
  } catch (error) { next(error); }
});

app.put('/api/pedidos/:id', async (req, res, next) => {
  const id = validarId(req.params.id);
  if (!id) return res.status(400).json({ error: 'Identificador no valido.' });
  const result = validarPedido(req.body);
  if (result.error) return res.status(400).json({ error: result.error });
  const { cliente, concepto, total, estado } = result.value;
  try {
    const updated = await pool.query(
      'UPDATE pedidos SET cliente=$1, concepto=$2, total=$3, estado=$4 WHERE id=$5 RETURNING id, cliente, concepto, total, estado, creado_en',
      [cliente, concepto, total, estado, id]
    );
    if (!updated.rowCount) return res.status(404).json({ error: 'Pedido no encontrado.' });
    res.json(updated.rows[0]);
  } catch (error) { next(error); }
});

app.delete('/api/pedidos/:id', async (req, res, next) => {
  const id = validarId(req.params.id);
  if (!id) return res.status(400).json({ error: 'Identificador no valido.' });
  try {
    const deleted = await pool.query('DELETE FROM pedidos WHERE id=$1 RETURNING id', [id]);
    if (!deleted.rowCount) return res.status(404).json({ error: 'Pedido no encontrado.' });
    res.json({ mensaje: 'Pedido eliminado', id });
  } catch (error) { next(error); }
});

app.use('/api', (_req, res) => res.status(404).json({ error: 'Ruta no encontrada.' }));
app.use((error, _req, res, _next) => {
  if (error instanceof SyntaxError && error.status === 400 && 'body' in error) {
    return res.status(400).json({ error: 'El cuerpo no contiene JSON valido.' });
  }
  console.error('Error de API:', error.message);
  res.status(503).json({ error: 'Servicio temporalmente no disponible.' });
});

async function iniciar() {
  await pool.query(`CREATE TABLE IF NOT EXISTS pedidos (
    id SERIAL PRIMARY KEY,
    cliente VARCHAR(100) NOT NULL,
    concepto VARCHAR(180) NOT NULL,
    total NUMERIC(10,2) NOT NULL CHECK (total >= 0),
    estado VARCHAR(20) NOT NULL DEFAULT 'Pendiente',
    creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`);
  const port = Number(process.env.PORT || 10000);
  const server = app.listen(port, '0.0.0.0', () => console.log(`Nexo Pedidos escuchando en puerto ${port}`));
  process.on('SIGTERM', () => server.close(() => pool.end()));
}

iniciar().catch((error) => {
  console.error('No se pudo iniciar el servicio y conectar con PostgreSQL:', error.message);
  process.exitCode = 1;
  pool.end().catch(() => {});
});
