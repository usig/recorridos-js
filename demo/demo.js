/**
 * Created by federuiz on 7/24/17.
 */
var Recorridos = require('../lib/recorridos.min').Recorridos;
var recorridos = Recorridos.init();
recorridos.buscarRecorridos({}, {}, "", {});
console.log (recorridos);
