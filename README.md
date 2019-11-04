# Recorridos

Este servicio permite consultar recorridos entre dos puntos dentro de la Ciudad de Buenos Aires,
ya sea en transporte publico o en bicicleta.

# Instalación

```
npm install @usig-gcba/recorridos
```

# Cómo usarlo

### ES6

```javascript
import { Recorridos } from '@usig-gcba/recorridos';

const recorridos = Recorridos.init();
```

# API

## Recorridos

#### init(opciones?: Object) => Recorridos

- **opciones**: objecto de configuracion con cualquiera de las siguientes propiedades:

| Opcion                        |   Tipo    |   Default    | Descripcion                     |
| ----------------------------- | :-------: | :----------: | :------------------------------ |
| **tipo**                      | _String_  | `transporte` | Idioma de los mensajes del mapa |
| **precargar**                 | _Number_  |     `5`      | Idioma de los mensajes del mapa |
| **opciones_caminata**         | _Number_  |    `800`     | Idioma de los mensajes del mapa |
| **opciones_medios_colectivo** | _boolean_ |    `true`    | Idioma de los mensajes del mapa |
| **opciones_medios_subte**     | _boolean_ |    `true`    | Idioma de los mensajes del mapa |
| **opciones_medios_tren**      | _boolean_ |    `true`    | Idioma de los mensajes del mapa |
| **max_results**               | _Number_  |     `15`     | Idioma de los mensajes del mapa |

#### buscarRecorridos(origen: Object, destino: Object, id: String, options: Object) => Promise<Array[RecorridoObject]>

_Dadas dos ubicaciones origen/destino y ciertas opciones de busqueda consulta los recorridos posibles._

## Recorrido

#### getGeoJson(recorrido: RecorridoObject) => Promise<GeoJson>

_Devuelve la representacion del recorrido en formato geoJson_

##### Parámetros

- **recorrido**: `RecorridoObject` recorrido.

##### Return

- `Promise` con el geoJson del recorrido.

#### getPlan(recorrido: Object) => Promise

_Devuelve el plan del recorrido_

##### Parámetros

- **recorrido**: `RecorridoObject` recorrido.

##### Return

- `Promise` con el plan del recorrido.

#### removePublicLayer(layerName: String)

_Remueve una capa en base a su nombre_

- **layerName**: `String` indicando el nombre de la capa

#### addMarker(latlng: Object, visible: boolean, draggable: boolean, goTo: boolean, activate: boolean, clickable: boolean, options: Object) => markerId: Number

_Agrega un marcador en la posicion especificada, retornando su id_

##### Parámetros

- **latlng**: `Object` posicion del marcador
  - **lat**: `Number` latitud
  - **lng**: `Number` longitud
- **visible**: `boolean` indicando si el marcador debe estar visible
- **draggable**: `boolean` indicando si el marcador puede ser arrastrado
- **goTo**: `boolean` indicando si el mapa debe recentrarse en el marcador
- **activate**: `boolean` indicando si se debe activar el marcador
- **clickable**: `boolean` indicando si el marcador puede ser clickeado
- **options**: `Object` datos a guardar dentro del marcador

##### Return

- **markerId**: `Number` id del marcador generado

#### selectMarker(markerId: String)

_Selecciona el marcador indicado_

##### Parámetros

- **markerId**: `Number` id del marcador a seleccionar

#### selectMarker(markerId: String) => boolean

_Pregunta si el marcador esta activo_

##### Parámetros

- **markerId**: `Number` id del marcador a analizar

#### removeMarker(markerId: String)

_Remueve el marcador indicado_

##### Parámetros

- **markerId**: `Number` id del marcador a remover

##### Return

- **seleccionado**: `boolean` indicando si el marcador esta seleccionado

#### addLocationMarker(position: Object, recenter: boolean, zoomIn: boolean) => [L.Marker](http://leafletjs.com/reference-1.3.0.html#marker)

_Agrega al mapa un marcador de ubicación actual en la posicion especificada_

##### Parámetros

- **position**: `Object` posicion del marcador
  - **coords**: `Object`
    - **latitude**: `Number` latitud
    - **longitude**: `Number` longitud
- **recenter**: `boolean` indicando si el mapa debe recentrarse en la posicion del marcador
- **zoomIn**: `boolean` indicando si se debe ajustar el nivel de zoom

##### Return

- **marker**: `L.marker` marcador agregado

#### mostrarRecorrido(recorrido: Object)

_Agrega un recorrido al mapa_

##### Parámetros

- **recorrido**: `Object` recorrido a ser agregado. El mismo debe seguir cierta [estructura](https://www.npmjs.com/package/@usig-gcba/recorridos)

#### ocultarRecorrido(recorrido: Object)

_Remueve el recorrido del mapa_

##### Parámetros

- **recorrido**: `Object` recorrido a ser removido.

## RecorridoObject

Objeto que representa a un recorrido. El servicio devuelve este tipo de objetos al realizar una búsqueda.
