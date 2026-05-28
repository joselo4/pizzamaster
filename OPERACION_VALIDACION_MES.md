
# Validación única (mes calendario)

## Objetivo
Una entrega por paciente por mes/año.

## Implementación
En BD se usan columnas `delivery_year` y `delivery_month` + índice único parcial:
- unique(patient_id, delivery_year, delivery_month) WHERE status <> 'ANULADO'

Esto permite registrar una nueva entrega en el mismo mes si la anterior fue ANULADA.

## Mensaje al usuario
Si se intenta duplicar:
"Ya existe una entrega para este paciente en el mes seleccionado. Si corresponde, anule la anterior y registre la nueva."
