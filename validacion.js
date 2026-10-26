'use strict';

const ESTADOS = ['Pendiente', 'En proceso', 'Completado'];

function validarPedido(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { error: 'Envia un objeto JSON valido.' };
  }

  const cliente = typeof body.cliente === 'string' ? body.cliente.trim() : '';
  const concepto = typeof body.concepto === 'string' ? body.concepto.trim() : '';
  const estado = body.estado === undefined ? 'Pendiente' : body.estado;
  const total = body.total;

  if (!cliente || cliente.length > 100) {
    return { error: 'El nombre del cliente debe tener entre 1 y 100 caracteres.' };
  }
  if (!concepto || concepto.length > 180) {
    return { error: 'El concepto debe tener entre 1 y 180 caracteres.' };
  }
  if (typeof total !== 'number' || !Number.isFinite(total) || total < 0 || total > 99999999.99 || !/^\d+(?:\.\d{1,2})?$/.test(String(total))) {
    return { error: 'El total debe ser un numero positivo con maximo dos decimales.' };
  }
  if (!ESTADOS.includes(estado)) {
    return { error: 'Estado incorrecto. Usa Pendiente, En proceso o Completado.' };
  }

  return { value: { cliente, concepto, total, estado } };
}

function validarId(raw) {
  if (!/^\d+$/.test(String(raw))) return null;
  const id = Number(raw);
  return Number.isSafeInteger(id) && id > 0 && id <= 2147483647 ? id : null;
}

module.exports = { ESTADOS, validarPedido, validarId };
