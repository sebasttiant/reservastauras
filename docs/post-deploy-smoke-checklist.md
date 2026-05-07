# Checklist smoke post-deploy

Usá esta lista después de un deploy o antes de una demo para confirmar que la experiencia pública y la operación básica siguen sanas.

## Camino rápido

- [ ] Abrí la home pública (`/`) y confirmá que carga en español.
- [ ] Cambiá a inglés desde `English` y confirmá que la URL queda `/?lang=en`.
- [ ] Volvé a `Español` y confirmá que la URL vuelve a `/`.
- [ ] Revisá que el formulario muestre campos de reserva, contacto y consentimientos.
- [ ] Entrá a `/admin/login` y confirmá que el formulario de acceso carga.
- [ ] Revisá logs del servicio web durante la prueba y confirmá que no hay errores nuevos.

## Si la demo incluye flujo operativo

- [ ] Creá una reserva pública de prueba solo si el entorno está preparado para datos demo.
- [ ] Entrá al panel admin.
- [ ] Confirmá que la reserva aparece pendiente.
- [ ] Probá una acción administrativa acordada para la demo: confirmar, rechazar o cancelar.

## Criterio de corte

Si falla carga pública, cambio de idioma, login admin o aparecen errores nuevos en logs, frená la demo/deploy y registrá el síntoma antes de tocar producción.
