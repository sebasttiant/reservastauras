# Contrato de enlaces para campañas de reservas web

Los enlaces de campaña deben apuntar a `https://reservas.tauras.com.co/` con un valor `venue` permitido. El sistema normaliza los alias de sede antes de preseleccionar, transferir o persistir la atribución.

## URLs válidas

| URL de entrada | `landingVenue` canónico |
|---|---|
| `https://reservas.tauras.com.co/?venue=steakhouse` | `steakhouse` |
| `https://reservas.tauras.com.co/?venue=steakhouse-poblado` | `steakhouse` |
| `https://reservas.tauras.com.co/?venue=tex-mex` | `tex-mex` |
| `https://reservas.tauras.com.co/?venue=tex-mex-palmas` | `tex-mex` |
| `https://reservas.tauras.com.co/?venue=bar-lounge` | `bar-lounge` |

No se admiten variantes, slugs internos ni inferencias. Un valor desconocido se ignora y no bloquea la reserva.

## Página pública y botón de reserva

La página pública debe construir el enlace del botón de reserva hacia `https://reservas.tauras.com.co/`. El botón transfiere **únicamente** `venue` y los cinco parámetros UTM permitidos: `utm_source`, `utm_medium`, `utm_campaign`, `utm_content` y `utm_term`. Nunca transfiere parámetros de consulta arbitrarios.

Ejemplo concreto:

- Página pública: `https://steakhouse-poblado.tauras.com.co/?utm_source=google&utm_medium=cpc&utm_campaign=steakhouse_agosto`
- Botón de reserva: `https://reservas.tauras.com.co/?venue=steakhouse-poblado&utm_source=google&utm_medium=cpc&utm_campaign=steakhouse_agosto`

Los valores UTM se recortan, los vacíos se descartan y cada valor se limita a 200 caracteres. Los parámetros permitidos se conservan al cambiar de idioma y se envían con la reserva; el `venue` transferido en esos enlaces se normaliza antes de persistir `landingVenue`.

Ejemplos:

- Google Ads: `https://reservas.tauras.com.co/?venue=steakhouse-poblado&utm_source=google&utm_medium=cpc&utm_campaign=steakhouse_poblado`
- Meta para Tex Mex: `https://reservas.tauras.com.co/?venue=tex-mex-palmas&utm_source=meta&utm_medium=paid_social&utm_campaign=tex_mex_palmas`

La atribución no depende del encabezado `Referer`: solo utiliza `venue` y los cinco UTM permitidos que estén explícitos en la URL. `landingVenue` registra la sede de entrada normalizada y permanece independiente de `locationId`, la sede finalmente seleccionada para la reserva.
