'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { validarPedido, validarId } = require('../validacion');

test('acepta un pedido correcto', () => {
  assert.deepEqual(validarPedido({ cliente: '  Ana  ', concepto: 'Monitor', total: 199.99 }), {
    value: { cliente: 'Ana', concepto: 'Monitor', total: 199.99, estado: 'Pendiente' },
  });
});

test('rechaza nombres vacios, total negativo, decimales excesivos y estados desconocidos', () => {
  for (const pedido of [
    { cliente: '', concepto: 'Teclado', total: 12 },
    { cliente: 'Ana', concepto: 'Teclado', total: -1 },
    { cliente: 'Ana', concepto: 'Teclado', total: 12.345 },
    { cliente: 'Ana', concepto: 'Teclado', total: 15, estado: 'Cancelado' },
  ]) {
    assert.ok(validarPedido(pedido).error);
  }
});

test('valida id numerico sin permitir inyeccion ni rangos invalidos', () => {
  assert.equal(validarId('25'), 25);
  assert.equal(validarId('25 OR 1=1'), null);
  assert.equal(validarId('-1'), null);
  assert.equal(validarId('2147483648'), null);
});
