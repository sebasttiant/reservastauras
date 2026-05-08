# Roadmap de reservas Tauras

Este documento conserva el norte comercial y técnico del sistema de reservas. El objetivo inmediato es no perder el aprendizaje de la reunión comercial mientras cerramos el MVP con seguridad, trazabilidad y revisión ordenada.

## Ahora: MVP operativo seguro

| Área | Decisión |
|------|----------|
| Reservas manuales | El admin debe poder cargar reservas que llegan por WhatsApp, llamada, Instagram, Facebook, CRM, presencial u otro canal. |
| Trazabilidad interna | Cada reserva manual conserva origen y admin creador. |
| Export | El export debe mostrar origen/cargada por sin exponer IDs internos. |
| Seguridad | No se salta Trivy, no se ocultan CVEs en `.trivyignore` sin justificación técnica, no se agregan dependencias innecesarias. |
| Verificación | Mantener `typecheck`, `lint`, tests y CI como barrera mínima. |

## Siguiente: Fase 1 comercial / Google Ads

La comercial necesita medir conversiones reales por marca/restaurante. El problema actual no es solo recibir reservas: es saber si la pauta pagada terminó en una solicitud enviada.

### Alcance pendiente

- Rutas públicas por marca/restaurante, por ejemplo:
  - `/reservas/texmex`
  - `/reservas/steakhouse`
  - `/reservas/bar`
- Página real de gracias por marca, por ejemplo:
  - `/gracias/texmex`
  - `/gracias/steakhouse`
  - `/gracias/bar`
- Captura de UTMs:
  - `utm_source`
  - `utm_medium`
  - `utm_campaign`
  - `utm_content`
- Persistir restaurante/marca/origen de campaña en la reserva.
- Mostrar y filtrar por marca/origen/campaña en admin cuando aplique.
- Preparar Google Ads conversion tracking sobre la página de gracias, no solo sobre la visita al formulario.
- Mantener un dashboard centralizado aunque existan rutas públicas separadas.

### Decisiones pendientes antes de implementar

- Dominio final: probablemente `tauras.com.co`, con redirecciones desde dominios anteriores.
- Nombres oficiales de marcas/restaurantes.
- Slugs oficiales de URL.
- Eventos de conversión que usará marketing.
- Responsable de actualizar la web principal para enlazar cada botón de reserva correcto.

## Backlog técnico no bloqueante

- Reenviar email de confirmación desde el detalle de una reserva ya confirmada.
- Exponer filtros de fecha/estado en la UI antes de exportar.
- Revisar rate limit para login/export/reservas.
- Mejorar mensajes de validación en formularios admin.
- Evaluar aviso de reservas cruzadas antes de crear una reserva manual.
- Definir si se permitirán reservas manuales retroactivas como bitácora histórica.

## Regla de seguridad

Si CI, Trivy o audit fallan, se corrige la causa o se documenta una excepción técnica real. No se silencian controles para “pasar verde”.
