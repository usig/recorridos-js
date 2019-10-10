import es6 from 'es6-promise';
import 'isomorphic-fetch';
import fetchJsonp from 'fetch-jsonp';
import TripTemplate from './tripTemplate';
import Recorrido from './recorrido';
import 'url-search-params-polyfill';
es6.polyfill();
const defaults = {
  debug: false,
  server: 'https://recorridos.usig.buenosaires.gob.ar/2.0/',
  searchApi: 'consultar_gba',
  serverTimeout: 20000,
  maxRetries: 1,
  lang: 'es',
  consultaRecorridos: {
    tipo: 'transporte',
    gml: true,
    precargar: 5,
    opciones_caminata: 800,
    opciones_medios_colectivo: true,
    opciones_medios_subte: true,
    opciones_medios_tren: true,
    opciones_prioridad: 'avenidas',
    opciones_incluir_autopistas: true,
    opciones_cortes: true,
    max_results: 15
  },
  colorTemplates: [
    new TripTemplate(0, '#0074FF'),
    new TripTemplate(1, '#DD0083'),
    new TripTemplate(2, '#009866'),
    new TripTemplate(3, '#FF9E29'),
    new TripTemplate(4, '#FF6633'),
    new TripTemplate(5, '#5B3BA1'),
    new TripTemplate(6, '#98C93C'),
    new TripTemplate(7, '#EE3A39'),
    new TripTemplate(8, '#4ED5F9'),
    new TripTemplate(9, '#FFCC05'),
    new TripTemplate(10, '#84004F'),
    new TripTemplate(11, '#00A5EB'),
    new TripTemplate(12, '#016406'),
    new TripTemplate(13, '#AB62D2'),
    new TripTemplate(14, '#C49F25'),
    new TripTemplate(15, '#9F2510'),
    new TripTemplate(16, '#0003CF'),
    new TripTemplate(17, '#CBA4FA'),
    new TripTemplate(18, '#00FFC9'),
    new TripTemplate(19, '#DC6767')
  ]
};

function mkRequest(data, address, serverDefaults) {
  let searchParams = new URLSearchParams();
  Object.keys(data).forEach(key => searchParams.append(key, data[key]));

  return fetchJsonp(address + '?' + searchParams.toString(), serverDefaults)
    .then(resp => resp.json())
    .then(data => data)
    .catch(err => {
      throw { error: err, data: data };
    });
}
function mkCallbackRequest(data, success, address, serverDefaults, requestId) {
  let searchParams = new URLSearchParams();
  Object.keys(data).forEach(key => searchParams.append(key, data[key]));

  return fetchJsonp(address + '?' + searchParams.toString(), serverDefaults)
    .then(resp => resp.json())
    .then(data => success(data))
    .catch(err => {
      throw { error: err, data: data, requestId: requestId };
    });
}

const Recorridos = {
  options: {},
  lastRequest: {},
  serverDefaults: {},
  init(options) {
    this.lastRequest = null;
    this.options = {};
    Object.assign(this.options, defaults, options);
    Object.assign(
      this.options.consultaRecorridos,
      defaults.consultaRecorridos,
      options
    );
    this.serverDefaults = {};
    Object.assign(
      this.serverDefaults,
      {
        type: 'GET',
        url: this.options.server,
        dataType: 'json',
        timeout: this.options.serverTimeout
      },
      options
    );
    return this;
  },
  getUbicacion(place) {
    let ubicacion = {
      coordenadas: { x: 0, y: 0 },
      codigo_calle: 0,
      altura: 0,
      codigo_calle2: 0
    };
    if (place.x !== undefined && place.y !== undefined) {
      ubicacion.coordenadas = place;
    }
    ubicacion.coordenadas = place.coordenadas;

    if (place.tipo === 'DIRECCION') {
      if (place.tipoDireccion === 1) {
        ubicacion.codigo_calle2 = place.calleCruce.codigo;
      }
      ubicacion.codigo_calle = place.calle.codigo
        ? place.calle.codigo
        : place.calle.cod_calle;
      ubicacion.altura = place.altura;
    }
    return ubicacion;
  },
  _expandirOrigenDestino(origen, destino) {
    let data = {},
      ubicacionOrigen = this.getUbicacion(origen);
    if (ubicacionOrigen.coordenadas) {
      data.origen =
        ubicacionOrigen.coordenadas.x + ',' + ubicacionOrigen.coordenadas.y;
    }
    data.origen_calles2 = ubicacionOrigen.codigo_calle2;
    data.origen_calles = ubicacionOrigen.codigo_calle;
    data.origen_calle_altura = ubicacionOrigen.altura;
    let ubicacionDestino = this.getUbicacion(destino);

    if (ubicacionDestino.coordenadas) {
      data.destino =
        ubicacionDestino.coordenadas.x + ',' + ubicacionDestino.coordenadas.y;
    }

    data.destino_calles2 = ubicacionDestino.codigo_calle2;
    data.destino_calles = ubicacionDestino.codigo_calle;
    data.destino_calle_altura = ubicacionDestino.altura;
    return data;
  },
  onBuscarRecorridosSuccess(data, origen, destino, requestId) {
    let recorridos = [],
      templates = this.options.colorTemplates,
      lang = this.options.lang;
    if (this.options.debug)
      console.log('usig.Recorridos onBuscarRecorridosSuccess');
    data.planning.forEach((plan, i) => {
      let trip_plan = JSON.parse(plan);
      let template;
      switch (trip_plan.type) {
        case 'car':
          template = templates[1];
          break; //fuccia
        case 'bike':
          template = templates[0];
          break; //azul
        case 'walk':
          template = templates[2];
          break; //verde
        case 'transporte_publico':
          template = templates[i];
          break;
      }
      recorridos.push(
        Recorrido.construirRecorrido(
          JSON.parse(plan),
          { template: template, lang: lang },
          origen,
          destino
        )
      );
    });
    return { recorridos: recorridos, requestId: requestId };
  },
  /**
   * Dado un determinado tripPlan busca el detalle del mismo
   * @param {Object} data: {trip_id: int} el id del trip_plan
   * @param {Function} success Funcion callback que es llamada con el listado de categorias obtenido del servidor
   * @param {Function} error Funcion callback que es llamada en caso de error
   */
  loadTripPlan(data) {
    this.lastRequest = mkRequest(
      data,
      this.options.server + 'load_plan',
      this.serverDefaults
    );
    return this.lastRequest;
  },
  /**
   * Dadas dos ubicaciones origen/destino y ciertas opciones de busqueda consulta los recorridos posibles.
   * @param {Object} data Objeto que contiene datos del origen y destino, asi como las opciones de busqueda: <br/>
   * 		{String} action: (ej: "http://recorridos.usig.buenosaires.gob.ar/recorridos_transporte") <br/>
   *		{String} destino: son las coordenadas xy de la ubicacion destino separadas por "," <br/>
   *		{int} destino_calle_altura: Altura de la calle destino. Si la ubicacion no tiene Dir es vacio <br/>
   *		{int} destino_calles: Codigo de la calle destino. Si la ubicacion no tiene Dir es cero <br/>
   *		{String} origen: son las coordenadas xy de la ubicacion origen separadas por "," <br/>
   *		{int} origen_calle_altura: Altura de la calle origen. Si la ubicacion no tiene Dir es vacio <br/>
   *		{int} origen_calles: Codigo de la calle origen. Si la ubicacion no tiene Dir es cero <br/>
   *		Si la consulta es de transporte publico: <br/>
   *		{int} opciones_caminata: Caminata maxima <br/>
   *		{boolean} opciones_medios_colectivo: Es true si esta marcada la opcion de tener en cuenta colectivos para buscar el recorrido <br/>
   *		{boolean} opciones_medios_subte: Es true si esta marcada la opcion de tener en cuenta subtes para buscar el recorrido <br/>
   *		{boolean} opciones_medios_tren: Es true si esta marcada la opcion de tener en cuenta trenes para buscar el recorrido <br/>
   *		Si la consulta es de recorrido en auto: <br/>
   *		{String} opciones_prioridad: Toma los valores "avenidas" o "corto" <br/>
   *		{Boolean} opciones_incluir_autopistas: Es true si se deben tomar en cuenta las autopistas <br/>
   * @param {String} tipo: Toma los valores 'transporte', 'auto' o 'pie'
   * @param {Function} success Funcion callback que es llamada con el resultado obtenido del servidor
   * @param {Function} error Funcion callback que es llamada en caso de error
   */
  consultarRecorridos(data, tipo) {
    this.lastRequest = mkRequest(
      data,
      this.options.server + 'recorridos_' + tipo,
      this.serverDefaults
    );
    return this.lastRequest;
  },
  /**
   * Dada una ubicacion trae informacion del transporte que pasa por esa ubicacion
   * @param {Object} data Objeto que contiene las coordenadas xy de la ubicacion
   * @param {Function} success Funcion callback que es llamada con el listado de categorias obtenido del servidor
   * @param {Function} error Funcion callback que es llamada en caso de error
   */
  InfoTransporte(data) {
    this.lastRequest = mkRequest(
      data,
      this.options.server + 'info_transporte/',
      this.serverDefaults
    );
    return this.lastRequest;
  },
  /**
   * Dadas dos ubicaciones origen/destino y ciertas opciones de busqueda consulta los recorridos posibles.
   * @param {usig.Direccion/usig.inventario.Objeto/usig.DireccionMapabsas/usig.Punto} origen Origen del recorrido
   * @param {usig.Direccion/usig.inventario.Objeto/usig.DireccionMapabsas/usig.Punto} destino Destino del recorrido
   * @param {Function} success Funcion callback que es llamada cuando se obtiene una respuesta exitosa del servidor.
   * Recibe como parametro un Array(usig.Recorrido) con las opciones encontradas.
   * @param {Function} error Funcion callback que es llamada en caso de error
   * @param {Object} options (optional) Un objeto conteniendo overrides para las opciones disponibles
   */
  buscarRecorridos(origen, destino, id, options) {
    var origenDestino = {};
    if (origen && destino) {
      origenDestino = this._expandirOrigenDestino(origen, destino);
    }
    let data = Object.assign(
      {},
      this.options.consultaRecorridos,
      options,
      origenDestino
    );
    data.origen_nombre = origen.nombre;
    data.destino_nombre = destino.nombre;

    this.lastRequest = mkCallbackRequest(
      data,
      data => this.onBuscarRecorridosSuccess(data, origen, destino, id),
      this.options.server + this.options.searchApi,
      this.serverDefaults,
      id
    );
    return this.lastRequest;
  },
  cargarPlanRecorrido(id, options, origen, destino) {
    let origenDestino = {};
    if (origen && destino) {
      origenDestino = this._expandirOrigenDestino(origen, destino);
    }
    let data = Object.assign(
      {},
      this.options.consultaRecorridos,
      options,
      origenDestino
    );
    data.trip_id = id;
    data.tipo = 'loadplan';

    this.lastRequest = mkRequest(
      data,
      this.options.server + this.options.searchApi,
      this.serverDefaults
    );
    return this.lastRequest;
  },
  /**
   * Permite consultar los transportes cercanos a una ubicacion dada.
   * @param {usig.Direccion/usig.inventario.Objeto/usig.DireccionMapabsas/usig.Punto} lugar Lugar a consultar
   * @param {Function} success Funcion callback que es llamada con el resultado obtenido del servidor
   * @param {Function} error Funcion callback que es llamada en caso de error
   *
   */
  transportesCercanos(lugar) {
    let ubicacion = this.getUbicacion(lugar);
    let data = { x: ubicacion.coordenadas.x, y: ubicacion.coordenadas.y };
    this.lastRequest = mkRequest(
      data,
      this.options.server + 'info_transporte/',
      this.serverDefaults
    );
    return this.lastRequest;
  },

  /**
   * Permite consultar las ciclovias cercanas a una ubicacion dada.
   * @param {usig.Direccion/usig.inventario.Objeto/usig.DireccionMapabsas/usig.Punto} lugar Lugar a consultar
   * @param {Function} success Funcion callback que es llamada con el resultado obtenido del servidor
   * @param {Function} error Funcion callback que es llamada en caso de error
   * @param {Object} options (optional) Un objeto conteniendo opciones. Las opciones disponibles son:
   * <b>radio</b> en metros (por defecto sin limite) y <b>cantidad</b> de resultados a obtener
   * (por defecto 5)
   */
  cicloviasCercanas(lugar, options) {
    let ubicacion = this.getUbicacion(lugar);
    let data = { lon: ubicacion.coordenadas.x, lat: ubicacion.coordenadas.y };
    if (options) {
      if (options.radio) data.radio = options.radio;
      if (options.cantidad) data.cantidad = options.cantidad;
    }
    this.lastRequest = mkRequest(
      data,
      this.options.server + 'ciclovias_cercanas/',
      this.serverDefaults
    );
    return this.lastRequest;
  },
  isEqual(recorrido1, recorrido2) {
    return (
      recorrido1.tipo === recorrido2.tipo &&
      recorrido1.descripcion === recorrido2.descripcion &&
      recorrido1.coordOrigen === recorrido2.coordOrigen &&
      recorrido1.coordDestino === recorrido2.coordDestino
    );
  },
  isEqualSearch(recorrido1, recorrido2) {
    return (
      recorrido1.origen.id === recorrido2.origen.id &&
      recorrido1.destino.id === recorrido2.destino.id &&
      recorrido1.modo === recorrido2.modo
    );
  }
};

export { Recorridos, Recorrido };
