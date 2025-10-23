# Estrategia BOS (Break of Structure) - Multi-Timeframe

## Descripción General

Esta estrategia implementa un análisis multi-timeframe (4H y 5M) basada en conceptos de Smart Money, específicamente Break of Structure (BOS) y zonas de retroceso de Fibonacci.

## Componentes Principales

### 1. Análisis de Tendencia (4H)

- **EMA (configurable)**: Indicador principal para determinar la tendencia
  - **Tendencia Alcista**: Cierre > EMA
  - **Tendencia Bajista**: Cierre < EMA
  - **Nota**: Por defecto usa EMA50 debido a límites de API. EMA200 es ideal pero requiere ~210 velas de 4H (35 días de datos)

### 2. Detección de BOS en 4H

- **BOS Alcista**: Precio rompe por encima del máximo reciente (swing high)
- **BOS Bajista**: Precio rompe por debajo del mínimo reciente (swing low)
- El BOS debe ocurrir a favor de la tendencia determinada por EMA
- Se identifica el **impulso** que causó el break (desde swing low hasta break point)

### 3. Zona de Retroceso 4H

- Una vez detectado el BOS, se calcula la zona de retroceso del impulso:
  - **Fibonacci 50%**: Retroceso del 50% del impulso
  - **Fibonacci 61.8%**: Retroceso del 61.8% del impulso
- Esta zona actúa como área de interés para entradas potenciales

### 4. Confirmación en 5M

- Se espera a que el precio toque la zona de retroceso (50-61.8%)
- Una vez en la zona, se analiza el timeframe de 5M
- Se busca un **BOS en 5M** a favor de la tendencia principal
- Este BOS en 5M actúa como confirmación de que el retroceso ha terminado

### 5. Entrada LIMIT

- Una vez confirmado el BOS en 5M, se calcula la zona de entrada:
  - Se toma el impulso del BOS de 5M
  - Se calcula el retroceso 50-61.8% de ese impulso
  - **Entrada propuesta**: En el nivel del 50% (Fibonacci)
  - **Stop Loss**: Detrás del pivot (ligeramente por debajo/arriba del 61.8%)
  - **Take Profit**: Ratio de riesgo-recompensa 1:2 (configurable)

## Flujo de la Estrategia

```
1. Verificar tendencia 4H (EMA50/200 configurable)
   ↓
2. Detectar BOS 4H a favor de la tendencia
   ↓
3. Calcular zona de retroceso 50-61.8% del impulso 4H
   ↓
4. Esperar a que precio entre en zona de retroceso
   ↓
5. Analizar 5M buscando BOS de confirmación
   ↓
6. Una vez BOS 5M confirmado, calcular entrada LIMIT
   ↓
7. Entrada en 50% del impulso 5M
   SL detrás del pivot (61.8%)
   TP con R:R 1:2
```

## Configuración

### Timeframes

```javascript
timeframes: {
  higher: "4h",    // Timeframe superior (tendencia y BOS principal)
  lower: "5m",     // Timeframe inferior (confirmación)
}
```

### Indicadores

```javascript
indicators: {
  ema200: 50,      // EMA para determinar tendencia (50 o 200, según datos disponibles)
  bos: {
    lookback4H: 20,              // Velas para detectar estructura en 4H
    lookback5M: 10,              // Velas para detectar estructura en 5M
    fibRetracementLow: 0.5,      // Nivel Fibonacci 50%
    fibRetracementHigh: 0.618,   // Nivel Fibonacci 61.8%
    riskRewardRatio: 2,          // R:R por defecto (1:2)
  }
}
```

## Ventajas de la Estrategia

1. **Multi-Timeframe**: Combina análisis de tendencia macro (4H) con confirmación micro (5M)
2. **Confirmación Doble**: Requiere BOS tanto en 4H como en 5M
3. **Zonas de Fibonacci**: Utiliza niveles de retroceso probados y utilizados por institucionales
4. **Gestión de Riesgo**: SL bien definido detrás del pivot, TP con ratio favorable
5. **Reduce Señales Falsas**: Múltiples confirmaciones antes de entrada

## Gestión de Riesgo

- **Stop Loss**: Colocado detrás del pivot (zona de 61.8%)
- **Take Profit**: 2x la distancia del riesgo (configurable)
- **Tamaño de Posición**: Calculado basado en % de riesgo de cuenta
- **Máximo de Operaciones**: Limitado por día (configurable)

## Estados del Bot

El bot mantiene un estado que incluye:

- Tendencia actual 4H
- BOS 4H detectado (si hay)
- Zona de retroceso 4H
- Estado de si el precio está en zona de retroceso
- BOS 5M detectado (si hay)
- Entrada propuesta (precio, SL, TP)

## Logging

El bot registra información detallada:

- Indicadores de ambos timeframes (4H y 5M)
- Estado completo de la estrategia BOS
- Detección de BOS con precios exactos
- Zonas de retroceso calculadas
- Propuestas de entrada con precios específicos

## Notas Importantes

1. **Requiere Datos Suficientes**: La configuración por defecto usa EMA50 (requiere ~60 velas de 4H). Si deseas usar EMA200, cambia `ema200: 200` en config.js y asegúrate que la API pueda devolver ~210 velas de 4H
2. **Paciencia**: Esta estrategia espera confirmaciones múltiples, puede tardar en generar señales
3. **Backtesting**: Se recomienda probar en modo test antes de operar en vivo
4. **Adaptación**: Los parámetros pueden ajustarse según el activo y condiciones de mercado
5. **Límites de API**: BingX puede limitar la cantidad de velas históricas, especialmente en timeframes altos como 4H

## Archivos Modificados

- `strategies/bos-strategy.js` - Nueva estrategia BOS multi-timeframe
- `bot.js` - Adaptado para análisis multi-timeframe
- `config.js` - Configuración para timeframes y parámetros BOS
- `bingx-api.js` - Añadidas funciones para órdenes LIMIT
- `indicators.js` - Añadido cálculo de EMA200

## Uso

```bash
# Asegúrate de tener las variables de entorno configuradas
BINGX_API_KEY=tu_api_key
BINGX_API_SECRET=tu_api_secret
SYMBOL=BTC-USDT

# Ejecutar el bot
node bot.js
```

## Modo Test

Por defecto, el bot opera en modo test. Para cambiar a modo en vivo:

```javascript
// config.js
bot: {
  testMode: false,  // Cambia a false para modo en vivo
  // ...
}
```

⚠️ **ADVERTENCIA**: Siempre prueba la estrategia en modo test antes de usar fondos reales.
