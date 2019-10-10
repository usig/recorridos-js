import TripTemplate from './tripTemplate';
import { Recorridos } from './recorridos';
const defaults = {
  icons: {
    recorrido_pie: '//mapa.buenosaires.gob.ar/images/recorrido_pie20x20.png',
    recorrido_subte:
      '//mapa.buenosaires.gob.ar/images/recorrido_subte20x20.png',
    recorrido_tren: '//mapa.buenosaires.gob.ar/images/recorrido_tren20x20.png',
    recorrido_colectivo:
      '//mapa.buenosaires.gob.ar/images/recorrido_colectivo20x20.png',
    recorrido_auto: '//mapa.buenosaires.gob.ar/images/recorrido_auto20x20.png',
    recorrido_bici:
      '//servicios.usig.buenosaires.gob.ar/usig-js/dev/images/recorrido_bici20x20.png'
  },
  template: new TripTemplate(1, '#8F58C7')
};

function getLineStringCoords(gml) {
  return gml
    .getElementsByTagName('gml-coordinates')[0]
    .childNodes[0].nodeValue.split(' ')
    .map(function(it) {
      return it.split(',').map(function(c) {
        return parseFloat(c);
      });
    });
}

function getMultiLineStringCoords(gml) {
  let coords = [];
  Array.prototype.slice
    .call(gml.getElementsByTagName('gml-lineStringMember'))
    .forEach(function(element) {
      coords.push(getLineStringCoords(element));
    });
  return coords;
}

function addGeoJsonMultiLineStrings(geoJson, ls, id) {
  ls.forEach(function(feature) {
    geoJson.features.push({
      type: 'Feature',
      properties: {
        gml_id: null,
        type: feature.getElementsByTagName('gml-type')[0].childNodes[0]
          .nodeValue,
        fid: null,
        paso_id: id
      },
      geometry: {
        type: 'MultiLineString',
        coordinates: getMultiLineStringCoords(feature)
      }
    });
  });
}

function addGeoJsonLineStrings(geoJson, ls, id) {
  ls.forEach(function(feature) {
    geoJson.features.push({
      type: 'Feature',
      properties: {
        gml_id: null,
        type: feature.getElementsByTagName('gml-type')[0].childNodes[0]
          .nodeValue,
        fid: null,
        paso_id: id
      },
      geometry: {
        type: 'LineString',
        coordinates: getLineStringCoords(feature)
      }
    });
  });
}

function addGeoJsonEdges(geoJson, edges, id) {
  if (edges instanceof Array) {
    edges = edges[0];
  }
  let $gml = new DOMParser().parseFromString(
    edges.replace(/:/g, '-'),
    'application/xml'
  );
  if ($gml.querySelectorAll('gml-feature > gml-MultiLineString').length > 0) {
    addGeoJsonMultiLineStrings(
      geoJson,
      Array.prototype.slice
        .call($gml.querySelectorAll('gml-feature > gml-MultiLineString'))
        .map(d => d.parentNode),
      id
    );
  } else {
    addGeoJsonLineStrings(
      geoJson,
      Array.prototype.slice
        .call($gml.querySelectorAll('gml-feature > gml-LineString'))
        .map(d => d.parentNode),
      id
    );
  }
}

function addGeoJsonMarker(geoJson, gml, id) {
  let $gml = new DOMParser().parseFromString(
    gml.replace(/:/g, '-'),
    'application/xml'
  );
  if ($gml.getElementsByTagName('gml-Point')[0]) {
    let coords = $gml
      .getElementsByTagName('gml-coordinates')[0]
      .childNodes[0].nodeValue.split(',');
    geoJson.features.push({
      type: 'Feature',
      properties: {
        gml_id: null,
        type: $gml.getElementsByTagName('gml-type')[0].childNodes[0].nodeValue,
        fid: null,
        paso_id: id
      },
      geometry: {
        type: 'Point',
        coordinates: [parseFloat(coords[0]), parseFloat(coords[1])]
      }
    });
  } else {
  }
}

const Recorrido = {
  construirRecorrido: (data, options, origen, destino) => {
    let recorrido = {};
    recorrido.options = Object.assign({}, defaults, options);
    recorrido.origen = origen;
    recorrido.destino = destino;
    if (data) Recorrido.loadData(recorrido, data);
    return recorrido;
  },
  loadData(recorrido, data) {
    try {
      recorrido.id = data.id;
      recorrido.tiempo = data.tiempo;
      recorrido.coordOrigen = data.origen;
      recorrido.coordDestino = data.destino;
      recorrido.tipo = data.type;
      recorrido.resumen = data.summary;
      recorrido.traveled_distance = data.traveled_distance;
      recorrido.data = Object.assign({}, data);
      recorrido.plan = undefined;
      recorrido.data.options = recorrido.options;
      recorrido.textAlertas = [];
      recorrido.descripcionHtml = 'Sin datos';
      recorrido.descripcion = 'Sin datos';
      recorrido.descripcionResumen = [];
      recorrido.proximosServicios = { horarios: {}, predicciones: [] };
      recorrido.predictivos = {};
      recorrido.estado = {};
      Recorrido.procesarResumen(recorrido);
      Recorrido.cargarPlan(recorrido);
      Recorrido.setTimeString(recorrido);
    } catch (e) {
      console.error(e);
    }
  },
  procesarResumen(recorrido) {
    //V3
    let desc = [];
    recorrido.descripcionHtml = '';
    if (recorrido.tipo === 'transporte_publico') {
      let estadoAnterior = null;
      recorrido.resumen.forEach((action, i) => {
        let step = undefined;
        if (action.type === 'Board') {
          if (estadoAnterior === 'Alight') {
            recorrido.descripcionResumen.push({
              servicio: 'combinacion',
              classNames: 'icons-sprite icon combinacion'
            });
          }
          if (action.service_type === 3) {
            //colectivo
            step = {
              linea: action.service,
              servicio: 'bus',
              classNames: 'pill colectivo' + action.service
            };
            recorrido.descripcionResumen.push(step);
            desc.push(action.service);
            step = undefined;
          } else if (action.service_type === 1) {
            //subte
            let lineas = action.service.split('-');

            lineas.forEach((linea, i) => {
              step = {
                servicio: 'subway',
                classNames: 'circlePill subte' + linea,
                linea: linea.replace('Premetro', 'P')
              };
              recorrido.descripcionResumen.push(step);
            });
            desc.push(action.service);
          } else if (action.service_type === 2) {
            //tren
            const titleName = action.long_name
              ? action.long_name
              : action.service;
            step = {
              servicio: 'train',
              linea: action.service.replace(/\./g, ''),
              classNames: 'pill trenpill',
              nombre: titleName
            };
            recorrido.descripcionResumen.push(step);
            desc.push(action.service);
          }
          if (action.alertas) {
            action.alertas.forEach((alerta, i) => {
              if (
                alerta.idioma.toLowerCase() ===
                recorrido.options.lang.toLowerCase()
              ) {
                recorrido.textAlertas.push({
                  mensaje: alerta.mensaje,
                  service: alerta.service
                });
              }
            });
          }
        }
        estadoAnterior = action.type;
      });
      recorrido.descripcion = desc.join(', ');
    } else if (recorrido.tipo === 'walk') {
      recorrido.resumen.forEach((action, i) => {
        if (action.type !== undefined && action.type === 'StartWalking') {
        }
      });
    } else if (recorrido.tipo === 'car') {
      recorrido.resumen.forEach((action, i) => {
        if (action.type !== undefined && action.type === 'StartDriving') {
        }
      });
    } else if (recorrido.tipo === 'bike') {
      recorrido.descripcionResumen.push({ servicio: 'bike' });
      recorrido.resumen.forEach((action, i) => {
        if (action.type !== undefined && action.type === 'StartBiking') {
          return false;
        }
      });
      if (recorrido.descripcionHtml === '') {
      }
    }
  },
  cargarPlan(recorrido) {
    if (!recorrido.plan && recorrido.data.plan) {
      recorrido.plan = recorrido.data.plan;

      Recorrido.procesarPlan(recorrido);
    }
    return recorrido.plan;
  },
  procesarPlan(recorrido) {
    recorrido.pasos = [];
    if (recorrido.tipo === 'transporte_publico') {
      let walking = false;
      let changes = 0;
      let ramal = null;
      let type_action = null;
      let features = [];
      let paso = {};
      let indexes = {
        walkIndex: 0,
        boardIndex: 0,
        alightIndex: 0
      };
      recorrido.plan.forEach((item, i) => {
        if (item.type !== undefined) {
          if (item.type === 'StartWalking') {
            walking = true;
            if (i === 0) {
              //Comienzo
              paso = {
                tipo: 'transportWalk',
                desde: recorrido.plan[i + 1].name
              };
            } else {
              //Venimos de un Aligh
              paso = { tipo: 'transportWalk' };
              if (recorrido.plan[i - 1].calle2 !== undefined) {
                paso.desde =
                  recorrido.plan[i - 1].calle1 +
                  ' y ' +
                  recorrido.plan[i - 1].calle2;
              } else {
                //calle2 puede ser null si el nodo no es una interseccion
                paso.desde = recorrido.plan[i - 1].calle1;
              }
            }
            type_action = 'pie';
          } else if (item.type === 'FinishWalking') {
            if (recorrido.plan[i - 1].type !== 'Alight') {
              features = [];
              paso = { tipo: 'transportWalk' };
              paso.hasta = {
                destino:
                  recorrido.plan[i - 1].name +
                  (recorrido.plan[i - 1] && recorrido.plan[i - 1] !== 0
                    ? ' ' + recorrido.plan[i - 1].to
                    : '')
              };
              paso.tiempo = item.time;
              paso.distancia = item.walked;
              paso.id = 'walk-' + indexes.walkIndex++;
              recorrido.pasos.push(paso);
              paso = undefined;
              walking = false;
            }
          } else if (item.type === 'Board') {
            let walking_state = walking;
            if (walking) {
              if (item.service_type === 3) {
                //colectivo
                if (item.calle2 !== null) {
                  paso.hasta = {
                    calle1: item.calle1,
                    calle2: item.calle2
                  };
                } else {
                  paso.hasta = {
                    calle1: item.calle1
                  };
                }
              } else {
                paso.hasta = {
                  stop: item.stop_name,
                  calle1: item.calle1
                };
                if (item.calle2) paso.hasta.calle2 = item.calle2;
              }

              //TODO poner valores reales
              paso.tiempo = 30;
              paso.distancia = item.walked;
              paso.id = 'walk-' + indexes.walkIndex++;
              recorrido.pasos.push(paso);
              paso = undefined;
              walking = false;
              type_action = null;
              features = [];
            }
            paso = {};
            paso.id = 'board-' + indexes.boardIndex++;
            if (item.service_type === 1) {
              //subte
              const linea =
                item.service.split(' ').length > 1
                  ? item.service.split(' ')[1]
                  : 'P';
              paso.tipo = 'board';
              paso.transporte = {
                linea: linea,
                nombre: 'Subte ' + item.service,
                servicio: 'subway',
                classNames: 'circlePill subte' + linea,
                tiempo: item.tiempo_estimado,
                costo: item.tarifa,
                all_ramales: item.any_trip,
                sentido: item.trip_description,
                carteles: item.alertas
              };

              paso.lugar = {
                tipo: 'Estacion',
                nombre: item.stop_name
              };
              type_action = 'subte';
            } else if (item.service_type === 3) {
              //colectivo
              paso.tipo = 'board';
              paso.transporte = {
                linea: item.service,
                servicio: 'bus',
                nombre: 'Colectivo ' + item.service,
                classNames: 'pill colectivo' + item.service,
                // tiempo: item.time,
                // costo: item.price
                tiempo: item.tiempo_estimado,
                costo: item.tarifa,
                all_ramales: item.any_trip,
                carteles: item.alertas
              };
              paso.lugar = {
                tipo: '',
                nombre: item.stop_description
              };
              if (
                item.trip_description &&
                item.trip_description !== '' &&
                !item.any_trip
              ) {
                //hay ramales y no son todos los que te llevan
                paso.transporte.ramales = item.trip_description.replace(
                  /\$/g,
                  ', '
                );
              } else {
              }

              type_action = 'colectivo';
            } else if (item.service_type === 2) {
              //tren
              paso.tipo = 'board';
              paso.transporte = {
                linea: item.service.replace(/\./g, ''),
                servicio: 'train',
                nombre: item.long_name,
                classNames: 'pill trenpill',
                // tiempo: item.time,
                // costo: item.price
                tiempo: item.tiempo_estimado,
                costo: item.tarifa,
                all_ramales: item.any_trip,
                carteles: item.alertas
              };
              paso.lugar = {
                tipo: 'Estacion',
                nombre: item.stop_name
              };
              if (item.trip_description !== '') {
                //hay ramales
                paso.transporte.ramales = item.trip_description.replace(
                  /\$/g,
                  ', '
                );
              } else {
              }
              type_action = 'tren';
              if (changes > 0) {
              }
            }
            recorrido.pasos.push(paso);
            paso = undefined;
          } else if (item.type === 'Alight') {
            paso = {
              tipo: 'alight',
              id: 'alight-' + indexes.alightIndex++
            };
            let lugar;
            if (
              item.service_type !== undefined &&
              (item.service_type === 2 || item.service_type === 1)
            ) {
              lugar = { tipo: 'Estacion', nombre: item.stop_name };
            } else if (item.metrobus) {
              //item.service_type == '3' // colectivo
              lugar = {
                tipo: 'Estacion',
                nombre:
                  item.stop_name + ' en ' + item.calle1 + ' y ' + item.calle2
              };
            } else {
              if (item.calle2 !== null) {
                lugar = {
                  tipo: 'Esquina',
                  nombre: item.calle1 + ' y ' + item.calle2
                };
              } else {
                lugar = { tipo: 'Altura', nombre: item.calle1 };
              }
            }
            paso.lugar = lugar;

            recorrido.pasos.push(paso);
            type_action = null;
            features = [];
            paso = undefined;
          } else if (item.type === 'Bus' && item.gml) {
            features.push(item.gml);
          } else if (item.type === 'SubWay' && item.gml) {
            if (features.length === 0) {
              features.push(item.gml);
            } else {
              let anterior = features[features.length - 1];
              if (
                anterior.search('gml:LineString') >= 0 &&
                anterior.search('subway') >= 0
              ) {
                let nextFeature = item.gml;
              } else {
                features.push(item.gml);
              }
            }
          } else if (item.type === 'SubWayConnection') {
            const pasoAlight = {
              tipo: 'alight',
              lugar: {
                tipo: 'Estacion',
                nombre: item.stop_from
              },
              id: 'alight-' + indexes.alightIndex++
            };
            recorrido.pasos.push(pasoAlight);

            paso = {
              tipo: 'board',
              connection: true,
              transporte: {
                linea: item.service_to.toUpperCase().replace('LÍNEA', ''),
                nombre: item.service_to,
                sentido: item.trip_description,
                tiempo: item.tiempo_estimado,
                classNames:
                  'circlePill subte' +
                  item.service_to.toUpperCase().replace('LÍNEA ', ''),
                all_ramales: true,
                servicio: 'subway'
              },
              lugar: {
                tipo: 'Estacion',
                nombre: item.stop
              },
              id: 'board-' + indexes.boardIndex++
            };

            recorrido.resumen.push(
              Object.assign({}, item, { stop: item.stop_id, gml: undefined })
            );
            recorrido.pasos.push(paso);
            paso = undefined;

            type_action = 'subte';
            features = [];
            // features.push(nextFeature);
          } else if (item.type === 'Street' && item.gml) {
            features.push(item.gml);
          }
        }
      });
      recorrido.pasos.push({
        tipo: 'end',
        lugar: { nombre: recorrido.destino.nombre },
        id: 'end'
      });
    } else if (recorrido.tipo === 'bike') {
      let walking = false;
      let actions = [];
      let index = 0;
      let text;
      let paso = {};
      recorrido.plan.forEach((item, i) => {
        let turn_indication;
        if (item.type !== undefined) {
          if (item.type === 'StartWalking') {
            walking = true;
          } else if (item.type === 'FinishWalking') {
            walking = false;
            recorrido.pasos.push(paso);
            paso = {};
          } else if (item.type === 'Street') {
            if (
              item.indicacion_giro !== 0 &&
              item.indicacion_giro !== 1 &&
              item.indicacion_giro !== 2
            ) {
              if (walking) {
                paso.tipo = 'bike';
              } else {
                paso.tipo = 'bike';
              }
              turn_indication = 'seguir';
            }
            if (item.tipo === 'Ciclovía') {
              paso.via = 'ciclovia';
            } else if (item.tipo === 'Carril preferencial') {
              paso.via = 'carril preferencial';
            }
            if (
              item.to === 0 ||
              item.from === 0 ||
              item.to === null ||
              item.from === null
            ) {
              paso.distancia = item.distance;
            } else {
              paso.distancia =
                item.to > item.from ? item.to - item.from : item.from - item.to;
            }
            if (item.from) {
              paso.desde = item.from;
            }
            if (item.to) {
              paso.hasta = item.to;
            }

            let modo = walking ? 'walk' : 'bike';
            paso.calle = item.name;
            paso.giro =
              item.indicacion_giro === ''
                ? -1
                : walking
                ? -2
                : item.indicacion_giro;
            paso.tipo = 'bike';
            if (!walking) {
              recorrido.pasos.push(paso);
              paso = {};
            }
            // end Street
          }
        }
      });
      recorrido.pasos.push({
        tipo: 'end',
        lugar: { nombre: recorrido.destino.nombre }
      });
    }
  },
  /**
   * Devuelve el recorrido en formato GeoJson
   * @return {Promise} GeoJson conteniendo la informacion geografica del recorrido
   */
  getGeoJson(recorrido) {
    if (recorrido.geoJson) {
      return new Promise((resolve, reject) => resolve(recorrido.geoJson));
    }
    return Recorrido.getPlan(recorrido).then(data => {
      const trip_plan = data.plan ? data.plan : data.planning;
      recorrido.plan = trip_plan;
      let indexes = {
        walkIndex: 0,
        boardIndex: 0,
        alightIndex: 0
      };
      if (trip_plan instanceof Array) {
        var g = { type: 'FeatureCollection', features: [] };
        let lastItem = undefined;
        trip_plan.forEach((item, i) => {
          if (item.type !== undefined) {
            if (
              lastItem &&
              lastItem.type === 'Alight' &&
              item.gml &&
              !lastItem.gml
            )
              addGeoJsonMarker(g, item.gml, 'alight-' + indexes.alightIndex++);
            if (item.type === 'StartWalking' || item.type === 'FinishWalking') {
              if (i == 0) {
                addGeoJsonMarker(
                  g,
                  item.gml.replace('walk', 'beginwalk'),
                  'walk-' + indexes.walkIndex++
                );
              } else {
                addGeoJsonMarker(g, item.gml, 'walk-' + indexes.walkIndex++);
              }
            } else if (item.type === 'Board') {
              if (i === 0) {
                addGeoJsonMarker(
                  g,
                  item.gml.replace(/(bus|subway|train)/g, 'begin$1')
                );
              } else {
                if (item.service_type == '1') {
                  switch (item.service) {
                    case 'Línea A':
                      if (item.gml.indexOf('subwayA') < 0) {
                        item.gml = item.gml.replace('subway', 'subwayA');
                      }
                      break;
                    case 'Línea B':
                      if (item.gml.indexOf('subwayB') < 0) {
                        item.gml = item.gml.replace('subway', 'subwayB');
                      }
                      break;
                    case 'Línea C':
                      if (item.gml.indexOf('subwayC') < 0) {
                        item.gml = item.gml.replace('subway', 'subwayC');
                      }
                      break;
                    case 'Línea D':
                      if (item.gml.indexOf('subwayD') < 0) {
                        item.gml = item.gml.replace('subway', 'subwayD');
                      }
                      break;
                    case 'Línea E':
                      if (item.gml.indexOf('subwayE') < 0) {
                        item.gml = item.gml.replace('subway', 'subwayE');
                      }
                      break;
                    case 'Línea H':
                      if (item.gml.indexOf('subwayH') < 0) {
                        item.gml = item.gml.replace('subway', 'subwayH');
                      }
                      break;
                  }
                }
                addGeoJsonMarker(g, item.gml);
              }
            } else if (item.type === 'Alight') {
              if (
                (item.service_type == '2' || item.service_type == '3') &&
                item.gml
              ) {
                addGeoJsonMarker(
                  g,
                  item.gml,
                  'alight-' + indexes.alightIndex++
                );
              }
            } else if (
              item.type === 'Bus' ||
              item.type === 'SubWay' ||
              item.type === 'Street'
            ) {
              let id = '';
              switch (item.type) {
                case 'SubWay':
                case 'Bus':
                  id = 'board-' + indexes.boardIndex++;
                  break;
              }
              addGeoJsonEdges(g, item.gml, id);
              // gml.addEdges([item.gml]);
            } else if (item.type === 'SubWayConnection') {
              switch (item.service_to) {
                case 'Línea A':
                  item.gml[1] = item.gml[1].replace('connection', 'subwayA');
                  break;
                case 'Línea B':
                  item.gml[1] = item.gml[1].replace('connection', 'subwayB');
                  break;
                case 'Línea C':
                  item.gml[1] = item.gml[1].replace('connection', 'subwayC');
                  break;
                case 'Línea D':
                  item.gml[1] = item.gml[1].replace('connection', 'subwayD');
                  break;
                case 'Línea E':
                  item.gml[1] = item.gml[1].replace('connection', 'subwayE');
                  break;
                case 'Línea H':
                  item.gml[1] = item.gml[1].replace('connection', 'subwayH');
                  break;
              }

              addGeoJsonMarker(
                g,
                item.gml[1],
                'alight-' + indexes.alightIndex++
              ); // en el caso de SubWayConnection el gml es un array de 3 elementos: punto inicial, punto final, linea que los une. Nos quedamos con el punto final
              addGeoJsonEdges(g, item.gml, i, 'board-' + indexes.boardIndex++);
            } else if (
              item.type === 'StartDriving' ||
              item.type === 'FinishDriving'
            ) {
              addGeoJsonMarker(g, item.gml);
            } else if (
              item.type === 'StartBiking' ||
              item.type === 'FinishBiking'
            ) {
              if (i === 0) {
                addGeoJsonMarker(g, item.gml.replace('bike', 'beginbike'));
              } else {
                addGeoJsonMarker(g, item.gml);
              }
            }
          }
          lastItem = item;
        });

        recorrido.geoJson = g;
        recorrido.plan = trip_plan;
        // Procesar plan para generar los pasos
        if (!recorrido.pasos) Recorrido.procesarPlan(recorrido);
        return g;
      }
    });
  },

  /**
   * Permite cargar datos de un recorrido obtenidos del servicio de recorridos de USIG
   * @param {Object} datos Datos del recorrido
   */
  load(datos) {
    Recorrido.loadData(datos);
  },

  /**
   * Devuelve el tiempo total del recorrido formateado como cadena
   * @return {String} Tiempo total del recorrido formateado
   */
  setTimeString(recorrido) {
    let time = '';
    //Mas de 60 mins
    if (recorrido.tiempo > 60) {
      let hs = Math.floor(recorrido.tiempo / 60);
      let mins = recorrido.tiempo % 60;
      time += hs + (hs > 1 ? 'hs ' : 'h ') + mins + "'";
    } else {
      time += recorrido.tiempo + "'";
    }
    recorrido.tiempoString = time;
  },

  /**
   * Devuelve la distancia total del recorrido formateada como cadena
   * @return {String} Distancia total del recorrido formateada
   */
  getDistanceString(recorrido) {
    let distance = '';
    //1 Km
    if (recorrido.traveled_distance > 999) {
      distance += (
        (recorrido.traveled_distance / 1000).toFixed(2) + ' Km'
      ).replace('.', ',');
    } else {
      distance += recorrido.traveled_distance + ' m';
    }
    return distance;
  },

  /**
   * Permite obtener el trip_plan del recorrido
   * @param {Function} success Una funcion que es llamada cuando se obtiene el detalle del recorrido.
   * Recibe de parametro un Array(String) con una lista de strings con la descripcion de cada uno de
   * los pasos del recorrido y un Object conteniendo el trip_plan obtenido del servidor
   * @param {Function} error Una funcion que es llamada en caso de error al intentar cargar el detalle
   * del recorrido
   * @returns {Object} trip_plan obtenido del servidor o undefined en caso de que aun no se encuentre cargado
   */
  getPlan(recorrido, opciones) {
    if (!recorrido.plan) {
      return Recorridos.cargarPlanRecorrido(recorrido.id, opciones);
    }
    return new Promise((resolve, reject) => resolve({ plan: recorrido.plan }));
  },
  /**
   * Permite obtener la descripcion detallada de cada uno de los pasos que componen el recorrido
   * @param {Function} success Una funcion que es llamada cuando se obtiene el detalle del recorrido.
   * Recibe de parametro un Array(String) con una lista de strings con la descripcion de cada uno de
   * los pasos del recorrido y un Object conteniendo el trip_plan obtenido del servidor
   * @param {Function} error Una funcion que es llamada en caso de error al intentar cargar el detalle
   * del recorrido
   */
  getDetalle(recorrido, opciones) {
    if (!recorrido.plan) {
      if (recorrido.data.plan) {
        return new Promise((resolve, reject) =>
          resolve(Recorrido.cargarPlan(recorrido))
        );
      } else {
        return Recorridos.cargarPlanRecorrido(
          recorrido.id,
          opciones,
          recorrido.origen,
          recorrido.destino
        );
      }
    }
  },

  /**
   * Devuelve el color asociado a este recorrido en formato HTML
   * @returns {String} Color en formato HTML hexadecimal
   */
  getColor() {
    return this.options.template.color;
  },

  getTipo() {
    return this.tipo;
  },

  /**
   * Permite setear un color a este recorrido
   * @param {String} color Color especificado en formato hexa HTML incluyendo el #, por ej.: '#4A5076'
   */
  setColor(color) {
    this.options.template.color = color;
  }
};
export default Recorrido;
