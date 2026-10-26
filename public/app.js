'use strict';

const $ = (id) => document.getElementById(id);
let pedidos = [];
let editando = null;

const dinero = (n) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Number(n));

function aviso(mensaje, error = false) {
  $('notice').textContent = mensaje;
  $('notice').className = error ? 'notice error' : 'notice';
}

async function solicitar(url, opciones = {}) {
  const response = await fetch(url, opciones);
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || `Error HTTP ${response.status}`);
  return payload;
}

function celda(texto, etiqueta = 'td') {
  const nodo = document.createElement(etiqueta);
  nodo.textContent = texto;
  return nodo;
}

function dibujar() {
  const tabla = $('tabla');
  tabla.replaceChildren();
  $('totalPedidos').textContent = String(pedidos.length);
  $('pendientes').textContent = String(pedidos.filter((pedido) => pedido.estado === 'Pendiente').length);
  $('ventas').textContent = dinero(pedidos.reduce((sum, p) => sum + Number(p.total), 0));

  if (!pedidos.length) {
    const tr = document.createElement('tr');
    const td = celda('Aun no tienes pedidos. Crea el primero desde el formulario.');
    td.colSpan = 4;
    td.className = 'empty';
    tr.append(td);
    tabla.append(tr);
    return;
  }

  for (const pedido of pedidos) {
    const tr = document.createElement('tr');
    const cliente = document.createElement('td');
    const nombre = document.createElement('strong');
    nombre.textContent = pedido.cliente;
    const concepto = document.createElement('small');
    concepto.textContent = `${pedido.concepto} · #${pedido.id}`;
    cliente.append(nombre, concepto);
    tr.append(cliente, celda(dinero(pedido.total)));

    const estadoTd = document.createElement('td');
    const estado = document.createElement('span');
    estado.className = 'pill ' + (pedido.estado === 'Completado' ? 'completado' : pedido.estado === 'En proceso' ? 'proceso' : '');
    estado.textContent = pedido.estado;
    estadoTd.append(estado);
    tr.append(estadoTd);

    const accionesTd = document.createElement('td');
    const acciones = document.createElement('div');
    acciones.className = 'actions';
    const editar = document.createElement('button');
    editar.textContent = 'Editar';
    editar.addEventListener('click', () => comenzarEdicion(pedido));
    const eliminar = document.createElement('button');
    eliminar.textContent = 'Eliminar';
    eliminar.className = 'remove';
    eliminar.addEventListener('click', () => borrar(pedido.id));
    acciones.append(editar, eliminar);
    accionesTd.append(acciones);
    tr.append(accionesTd);
    tabla.append(tr);
  }
}

async function cargar() {
  try {
    const response = await solicitar('/api/pedidos');
    pedidos = response.datos;
    dibujar();
  } catch (error) {
    aviso(`No fue posible consultar PostgreSQL: ${error.message}`, true);
    $('tabla').replaceChildren();
    const tr = document.createElement('tr');
    const td = celda('No se pudo cargar el listado; revisa los registros de Render.');
    td.colSpan = 4;
    td.className = 'empty';
    tr.append(td);
    $('tabla').append(tr);
  }
}

function comenzarEdicion(pedido) {
  editando = pedido.id;
  $('cliente').value = pedido.cliente;
  $('concepto').value = pedido.concepto;
  $('total').value = pedido.total;
  $('estado').value = pedido.estado;
  $('formTitle').textContent = `Editar pedido #${pedido.id}`;
  $('submitBtn').firstChild.textContent = 'Guardar cambios ';
  $('cancelBtn').hidden = false;
  $('cliente').focus();
}

function limpiar() {
  editando = null;
  $('pedidoForm').reset();
  $('formTitle').textContent = 'Crear pedido';
  $('submitBtn').firstChild.textContent = '+ Guardar pedido ';
  $('cancelBtn').hidden = true;
}

async function borrar(id) {
  if (!window.confirm(`¿Eliminar el pedido #${id}?`)) return;
  try {
    await solicitar(`/api/pedidos/${id}`, { method: 'DELETE' });
    if (editando === id) limpiar();
    await cargar();
    aviso(`Pedido #${id} eliminado correctamente.`);
  } catch (error) { aviso(error.message, true); }
}

$('pedidoForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  const body = {
    cliente: $('cliente').value.trim(),
    concepto: $('concepto').value.trim(),
    total: Number($('total').value),
    estado: $('estado').value,
  };
  const id = editando;
  $('submitBtn').disabled = true;
  try {
    await solicitar(id ? `/api/pedidos/${id}` : '/api/pedidos', {
      method: id ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    limpiar();
    await cargar();
    aviso(id ? 'Pedido actualizado correctamente.' : 'Pedido creado correctamente.');
  } catch (error) { aviso(error.message, true); }
  finally { $('submitBtn').disabled = false; }
});

$('cancelBtn').addEventListener('click', limpiar);
$('refreshBtn').addEventListener('click', cargar);
cargar();
