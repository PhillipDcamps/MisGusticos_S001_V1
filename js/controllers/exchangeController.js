// js/controllers/exchangeController.js
/**
 * Controlador de divisas / exchange.
 *
 * Conecta Dashboard.html con CurrencyService:
 *  - Pinta las tarjetas USD | EUR | BTC encima de Ahorros | Corriente | Tarjeta.
 *  - Abre el panel de "Exchange", muestra la vista previa y confirma la compra.
 *  - Inserta las filas del historial en la tabla de "Movimientos recientes"
 *    (en lugar del modal que desenfocaba el resto del dashboard).
 *
 * Recibe la instancia de TransactionController para COMPARTIR el mismo objeto
 * `cliente`. Si cada controlador tuviera su propia copia, al guardar uno
 * sobrescribiría los saldos que cambió el otro.
 */
class ExchangeController {
    static FILTRO_TODOS = '__todos';
    static FILTRO_DIVISAS = '__divisas';

    #tc;          // TransactionController
    #tasas = null;
    #ultimaTransaccionId = null;

    constructor(transactionController) {
        this.#tc = transactionController;
        if (!this.#tc?.cliente) return; // sin sesión, TransactionController ya redirigió

        this.cliente = this.#tc.cliente;

        // Referencias principales del DOM
        this.contenedorDivisas = document.getElementById('lista-divisas');
        this.contenedorSaldos = document.getElementById('lista-saldos');
        this.contenedorMovimientos = document.getElementById('lista-movimientos');
        this.selectFiltro = document.getElementById('cuenta-movimientos');
        this.modal = document.getElementById('modal-exchange');
        this.form = document.getElementById('form-exchange');

        this.renderizarTarjetasDivisas();
        this.prepararTablaMovimientos();
        this.integrarConTransactionController();
        this.inicializarEventListeners();
        this.cargarTasas();

        // Las tasas cambian poco: se refrescan cada 5 minutos
        setInterval(() => this.cargarTasas({ forzar: true }), CurrencyService.CACHE_MS);
    }

    // =====================================================================
    //  INTEGRACIÓN (sin borrar nada de TransactionController)
    // =====================================================================

    integrarConTransactionController() {
        const tc = this.#tc;

        // "Ver" de Movimientos recientes → pinta filas en la tabla, no en el modal
        tc.verMovimientos = () => {
            if (!this.selectFiltro.value) {
                tc.mostrarMensaje('Selecciona una cuenta', 'error');
                return;
            }
            this.renderizarTabla();
        };

        // Botón "Movimientos" de Acciones rápidas → lleva a la sección (sin blur)
        const abrirModalOriginal = tc.abrirModal.bind(tc);
        tc.abrirModal = (modalId) => {
            if (modalId === 'modal-movimientos') {
                this.irAMovimientos();
                return;
            }
            abrirModalOriginal(modalId);
        };

        // Cada vez que TransactionController repinta los saldos (consignar,
        // retirar, transferir, comprar, exchange) refrescamos la tabla.
        // El callback del MutationObserver también corre como MICROTAREA.
        new MutationObserver(() => this.renderizarTabla())
            .observe(this.contenedorSaldos, { childList: true });
    }

    inicializarEventListeners() {
        document.getElementById('btn-exchange')
            ?.addEventListener('click', () => this.abrirPanelExchange());

        // Un solo listener para todo el formulario (delegación de eventos)
        this.form?.addEventListener('input', () => this.actualizarVistaPrevia());
        this.form?.addEventListener('change', (e) => {
            if (e.target.id === 'exchange-origen') this.llenarSelectDestino();
            this.actualizarVistaPrevia();
        });
        this.form?.addEventListener('submit', (e) => this.confirmarExchange(e));

        // Cambiar el filtro ya actualiza la tabla (el botón "Ver" sigue funcionando)
        this.selectFiltro?.addEventListener('change', () => {
            if (this.selectFiltro.value) this.renderizarTabla();
        });
    }

    // =====================================================================
    //  TARJETAS USD | EUR | BTC
    // =====================================================================

    renderizarTarjetasDivisas() {
        if (!this.contenedorDivisas) return;
        const fragmento = document.createDocumentFragment();

        Object.entries(CurrencyService.DIVISAS).forEach(([codigo, info]) => {
            const card = document.createElement('div');
            card.className = 'balance-card currency-card is-loading';
            card.dataset.currency = codigo;
            card.innerHTML = `
                <div class="balance-header">
                    <span class="material-icons">${info.icono}</span>
                    <span class="currency-title">${codigo} · ${info.nombre}</span>
                    <span class="currency-trend trend-igual" title="Variación frente al día anterior">
                        <span class="material-icons">remove</span>
                        <span class="trend-value">—</span>
                    </span>
                </div>
                <p class="balance-label">Saldo en ${codigo}</p>
                <p class="balance-amount">${Transaction.formatearMonto(0, codigo)}</p>
                <p class="balance-sub currency-equivalente">≈ ${Transaction.formatearMonto(0, 'COP')}</p>
                <p class="balance-account currency-rate">
                    <span class="currency-rate-value">Cargando tasa…</span>
                    <span class="currency-rate-date"></span>
                </p>
            `;
            fragmento.appendChild(card);
        });

        this.contenedorDivisas.appendChild(fragmento);
    }

    /** Pide las tasas (Promesa) y actualiza las tarjetas cuando se resuelve */
    cargarTasas({ forzar = false } = {}) {
        return CurrencyService.obtenerTasas({ forzar })
            .then((tasas) => {
                this.#tasas = tasas;
                this.actualizarTarjetasDivisas();
                this.actualizarVistaPrevia();
                return tasas;
            })
            .catch((error) => {
                this.#tc.mostrarMensaje(`No fue posible cargar las tasas: ${error.message}`, 'error');
            });
    }

    actualizarTarjetasDivisas({ resaltar = [] } = {}) {
        if (!this.contenedorDivisas) return;
        const saldos = CurrencyService.obtenerSaldos(this.cliente.id);

        // DOM TRAVERSING: recorremos los hijos del contenedor y, dentro de cada
        // tarjeta, navegamos por sus elementos en vez de volver a crearla.
        Array.from(this.contenedorDivisas.children).forEach((card) => {
            const codigo = card.dataset.currency;
            const header = card.firstElementChild;                 // .balance-header
            const badge = header.lastElementChild;                 // .currency-trend
            const monto = header.nextElementSibling.nextElementSibling; // .balance-amount
            const equivalente = monto.nextElementSibling;          // .currency-equivalente
            const pie = card.lastElementChild;                     // .currency-rate

            const saldo = saldos[codigo] || 0;
            monto.textContent = Transaction.formatearMonto(saldo, codigo);

            const tasa = this.#tasas?.divisas?.[codigo];
            if (!tasa) return;

            equivalente.textContent = `≈ ${Transaction.formatearMonto(saldo * tasa.actual, 'COP')}`;

            // Flecha ascendente / descendente frente al día anterior
            const iconos = { sube: 'arrow_upward', baja: 'arrow_downward', igual: 'remove' };
            badge.className = `currency-trend trend-${tasa.tendencia}`;
            badge.firstElementChild.textContent = iconos[tasa.tendencia];
            const signo = tasa.variacionPct > 0 ? '+' : '';
            badge.lastElementChild.textContent = `${signo}${tasa.variacionPct.toFixed(2)}%`;
            badge.title = `Ayer: ${Transaction.formatearMonto(tasa.anterior, 'COP')} · ` +
                          `Variación: ${signo}${Transaction.formatearMonto(tasa.variacion, 'COP')}`;

            pie.querySelector('.currency-rate-value').textContent =
                `1 ${codigo} = ${Transaction.formatearMonto(tasa.actual, 'COP')}`;
            pie.querySelector('.currency-rate-date').textContent =
                `${this.#tasas.fecha}${this.#tasas.fuente === 'simulada' ? ' · simulada' : ''}`;

            card.classList.remove('is-loading');

            if (resaltar.includes(codigo)) {
                card.classList.remove('currency-card--updated');
                // requestAnimationFrame: esperamos al siguiente pintado para
                // que el navegador reinicie la animación
                requestAnimationFrame(() => card.classList.add('currency-card--updated'));
                card.addEventListener('animationend',
                    () => card.classList.remove('currency-card--updated'), { once: true });
            }
        });
    }

    // =====================================================================
    //  PANEL DE EXCHANGE
    // =====================================================================

    abrirPanelExchange() {
        if (!this.modal || !this.form) return;
        this.form.reset();
        this.llenarSelectOrigen();
        this.llenarSelectDestino();
        this.actualizarVistaPrevia();
        this.modal.style.display = 'flex';
        // Si las tasas aún no están, se piden (o se toman de la caché)
        if (!this.#tasas) this.cargarTasas();
        this.form.querySelector('#exchange-monto')?.focus();
    }

    cerrarPanelExchange() {
        if (this.modal) this.modal.style.display = 'none';
    }

    llenarSelectOrigen() {
        const select = this.form.querySelector('#exchange-origen');
        const saldos = CurrencyService.obtenerSaldos(this.cliente.id);
        select.innerHTML = '';

        const grupoCuentas = document.createElement('optgroup');
        grupoCuentas.label = 'Cuentas en COP';
        this.cliente.cuentas
            .filter((c) => c.tipo !== 'credito')
            .forEach((cuenta) => {
                grupoCuentas.appendChild(new Option(
                    `${CurrencyService.etiquetaCuenta(cuenta)} — ${Transaction.formatearMonto(cuenta.saldo, 'COP')}`,
                    `CTA:${cuenta.numeroCuenta}`
                ));
            });
        select.appendChild(grupoCuentas);

        const grupoDivisas = document.createElement('optgroup');
        grupoDivisas.label = 'Mis divisas';
        Object.keys(CurrencyService.DIVISAS).forEach((codigo) => {
            const opcion = new Option(
                `Billetera ${codigo} — ${Transaction.formatearMonto(saldos[codigo], codigo)}`,
                `DIV:${codigo}`
            );
            opcion.disabled = !(saldos[codigo] > 0); // solo se vende lo que se tiene
            grupoDivisas.appendChild(opcion);
        });
        select.appendChild(grupoDivisas);
    }

    /** Destino depende del origen: COP → divisas | divisa → otras divisas o cuentas COP */
    llenarSelectDestino() {
        const select = this.form.querySelector('#exchange-destino');
        const origen = this.#leerReferencia(this.form.querySelector('#exchange-origen').value);
        const anterior = select.value;
        select.innerHTML = '';

        const grupoDivisas = document.createElement('optgroup');
        grupoDivisas.label = 'Comprar divisa';
        Object.keys(CurrencyService.DIVISAS)
            .filter((codigo) => !(origen?.tipo === 'divisa' && origen.moneda === codigo))
            .forEach((codigo) => grupoDivisas.appendChild(
                new Option(`${codigo} · ${CurrencyService.DIVISAS[codigo].nombre}`, `DIV:${codigo}`)
            ));
        select.appendChild(grupoDivisas);

        if (origen?.tipo === 'divisa') {
            const grupoCuentas = document.createElement('optgroup');
            grupoCuentas.label = 'Vender a COP';
            this.cliente.cuentas
                .filter((c) => c.tipo !== 'credito')
                .forEach((cuenta) => grupoCuentas.appendChild(
                    new Option(CurrencyService.etiquetaCuenta(cuenta), `CTA:${cuenta.numeroCuenta}`)
                ));
            select.appendChild(grupoCuentas);
        }

        // Conservamos la elección anterior si sigue siendo válida
        if ([...select.options].some((o) => o.value === anterior)) select.value = anterior;
    }

    /** "CTA:xxx" / "DIV:USD" → { tipo, numeroCuenta | moneda } */
    #leerReferencia(valor) {
        if (!valor) return null;
        const [prefijo, dato] = valor.split(/:(.+)/);
        if (prefijo === 'CTA') return { tipo: 'cuenta', numeroCuenta: dato };
        if (prefijo === 'DIV') return { tipo: 'divisa', moneda: dato };
        return null;
    }

    #monedaDe(ref) {
        return ref?.tipo === 'divisa' ? ref.moneda : 'COP';
    }

    #saldoDe(ref) {
        if (!ref) return 0;
        if (ref.tipo === 'divisa') return CurrencyService.obtenerSaldos(this.cliente.id)[ref.moneda] || 0;
        return this.cliente.cuentas.find((c) => c.numeroCuenta === ref.numeroCuenta)?.saldo || 0;
    }

    /** Muestra el valor actual (moneda origen) y el futuro (moneda destino) */
    actualizarVistaPrevia() {
        if (!this.form) return;
        const origen = this.#leerReferencia(this.form.querySelector('#exchange-origen').value);
        const destino = this.#leerReferencia(this.form.querySelector('#exchange-destino').value);
        const input = this.form.querySelector('#exchange-monto');
        const boton = this.form.querySelector('button[type="submit"]');
        const preview = this.form.querySelector('.exchange-preview');

        const monedaOrigen = this.#monedaDe(origen);
        const monedaDestino = this.#monedaDe(destino);
        const monto = parseFloat(input.value) || 0;
        const disponible = this.#saldoDe(origen);

        // Traversing: subimos al .form-group y bajamos al <label> del input
        input.closest('.form-group').querySelector('label').textContent = `Monto a cambiar (${monedaOrigen})`;
        input.step = monedaOrigen === 'BTC' ? '0.00000001' : '0.01';
        input.nextElementSibling.textContent =
            `Disponible: ${Transaction.formatearMonto(disponible, monedaOrigen)}`;

        const campo = (nombre) => preview.querySelector(`[data-preview="${nombre}"]`);

        if (!this.#tasas) {
            campo('actual').textContent = Transaction.formatearMonto(monto, monedaOrigen);
            campo('futuro').textContent = 'Cargando tasas…';
            campo('tasa').textContent = '';
            boton.disabled = true;
            return;
        }

        const recibe = (origen && destino && monedaOrigen !== monedaDestino)
            ? Transaction.redondear(CurrencyService.convertir(monto, monedaOrigen, monedaDestino, this.#tasas), monedaDestino)
            : 0;

        campo('actual').textContent = Transaction.formatearMonto(monto, monedaOrigen);
        campo('actual-cop').textContent = monedaOrigen === 'COP' ? '' :
            `≈ ${Transaction.formatearMonto(CurrencyService.convertir(monto, monedaOrigen, 'COP', this.#tasas), 'COP')}`;
        campo('futuro').textContent = Transaction.formatearMonto(recibe, monedaDestino);
        campo('futuro-cop').textContent = monedaDestino === 'COP' ? '' :
            `≈ ${Transaction.formatearMonto(recibe * CurrencyService.tasaEnCop(monedaDestino, this.#tasas), 'COP')}`;

        const divisaTasa = monedaOrigen === 'COP' ? monedaDestino : monedaOrigen;
        campo('tasa').textContent = divisaTasa === 'COP' ? '' :
            `Tasa: 1 ${divisaTasa} = ${Transaction.formatearMonto(CurrencyService.tasaEnCop(divisaTasa, this.#tasas), 'COP')}`;

        const excede = monto > disponible + 1e-9;
        input.classList.toggle('input-error', excede);
        preview.classList.toggle('exchange-preview--error', excede);
        campo('saldo-despues').textContent = excede
            ? 'Saldo insuficiente'
            : `Saldo después: ${Transaction.formatearMonto(Math.max(disponible - monto, 0), monedaOrigen)}`;

        boton.disabled = !(monto > 0 && recibe > 0 && !excede);
    }

    async confirmarExchange(event) {
        event.preventDefault();
        const boton = this.form.querySelector('button[type="submit"]');
        const textoOriginal = boton.textContent;

        const datos = {
            origen: this.#leerReferencia(this.form.querySelector('#exchange-origen').value),
            destino: this.#leerReferencia(this.form.querySelector('#exchange-destino').value),
            monto: parseFloat(this.form.querySelector('#exchange-monto').value)
        };

        boton.disabled = true;
        boton.classList.add('is-processing');
        boton.textContent = 'Procesando…';

        try {
            // await: la función se pausa sin bloquear la página; al resolverse
            // la Promesa, el resto continúa desde la Microtask Queue.
            const transaccion = await CurrencyService.ejecutarExchange(this.cliente, datos);
            this.#ultimaTransaccionId = transaccion.id;

            this.cerrarPanelExchange();
            this.#tc.actualizarSaldos(); // dispara el MutationObserver → tabla
            this.actualizarTarjetasDivisas({
                resaltar: [transaccion.monedaOrigen, transaccion.monedaDestino]
            });
            this.#tc.mostrarMensaje(
                `✅ Exchange exitoso: ${transaccion.montoOrigenFormateado} → ${transaccion.montoDestinoFormateado}`,
                'success'
            );
        } catch (error) {
            this.#tc.mostrarMensaje(error.message, 'error');
        } finally {
            boton.classList.remove('is-processing');
            boton.textContent = textoOriginal;
            this.actualizarVistaPrevia();
        }
    }

    // =====================================================================
    //  MOVIMIENTOS RECIENTES (tabla con filas)
    // =====================================================================

    prepararTablaMovimientos() {
        if (!this.contenedorMovimientos) return;

        const tabla = document.createElement('table');
        tabla.className = 'movements-table';
        tabla.innerHTML = `
            <thead>
                <tr>
                    <th scope="col">Fecha</th>
                    <th scope="col">Movimiento</th>
                    <th scope="col">Tasa</th>
                    <th scope="col" class="col-monto">Monto</th>
                </tr>
            </thead>
            <tbody></tbody>
        `;
        tabla.style.display = 'none';
        // Se agrega DESPUÉS del mensaje vacío existente (no se elimina nada)
        this.contenedorMovimientos.appendChild(tabla);

        this.prepararFiltroMovimientos();
        this.selectFiltro.value = ExchangeController.FILTRO_TODOS;
        this.renderizarTabla();
    }

    /** Agrega "Todos" y "Divisas" al select existente, sin quitar sus opciones */
    prepararFiltroMovimientos() {
        if (!this.selectFiltro) return;
        const valorActual = this.selectFiltro.value;
        const placeholder = this.selectFiltro.querySelector('option[value=""]');

        [
            [ExchangeController.FILTRO_DIVISAS, '💱 Divisas (USD / EUR / BTC)'],
            [ExchangeController.FILTRO_TODOS, '📋 Todos los movimientos']
        ].forEach(([valor, texto]) => {
            if (this.selectFiltro.querySelector(`option[value="${valor}"]`)) return;
            const opcion = new Option(texto, valor);
            // Insertamos justo después del placeholder
            placeholder ? placeholder.after(opcion) : this.selectFiltro.prepend(opcion);
        });

        if (valorActual) this.selectFiltro.value = valorActual;
        // Si TransactionController recreó las opciones, volvemos a "Todos"
        if (!this.selectFiltro.value) this.selectFiltro.value = ExchangeController.FILTRO_TODOS;
    }

    obtenerTransacciones() {
        const filtro = this.selectFiltro?.value || ExchangeController.FILTRO_TODOS;
        const historial = CurrencyService.obtenerHistorial(this.cliente.id);
        const desdeCuenta = (cuenta, incluirExchange) => cuenta.movimientos
            // En "Todos" el exchange ya aparece como una sola fila completa
            .filter((mov) => incluirExchange || !String(mov.tipo).startsWith('Exchange'))
            .map((mov) => Transaction.desdeMovimiento(mov, cuenta, CurrencyService.etiquetaCuenta(cuenta)));

        let lista;
        if (filtro === ExchangeController.FILTRO_DIVISAS) {
            lista = historial;
        } else if (filtro === ExchangeController.FILTRO_TODOS) {
            lista = [
                ...historial,
                ...this.cliente.cuentas.flatMap((c) => desdeCuenta(c, false))
            ];
        } else {
            const cuenta = this.cliente.cuentas.find((c) => c.numeroCuenta === filtro);
            lista = cuenta ? desdeCuenta(cuenta, true) : [];
        }

        return lista.sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
    }

    renderizarTabla() {
        if (!this.contenedorMovimientos) return;
        const tabla = this.contenedorMovimientos.querySelector('.movements-table');
        const vacio = this.contenedorMovimientos.querySelector('.empty-state');
        if (!tabla) return;

        const tbody = tabla.tBodies[0];
        const transacciones = this.obtenerTransacciones();

        tbody.replaceChildren(); // limpia sólo las filas, no la tabla
        transacciones.forEach((t) => this.insertarFila(tbody, t));

        const hayFilas = transacciones.length > 0;
        tabla.style.display = hayFilas ? '' : 'none';
        if (vacio) vacio.style.display = hayFilas ? 'none' : '';
    }

    /** Inserta una fila al final del <tbody> usando insertRow / insertCell */
    insertarFila(tbody, t) {
        const fila = tbody.insertRow(-1);
        fila.dataset.id = t.id;
        fila.className = t.esExchange ? 'row-exchange' : 'row-movimiento';
        if (t.id === this.#ultimaTransaccionId) {
            fila.classList.add('row-new');
            this.#ultimaTransaccionId = null; // se resalta solo una vez
        }

        const celdaFecha = fila.insertCell();
        celdaFecha.className = 'col-fecha';
        celdaFecha.textContent = t.fechaFormateada;

        const icono = t.esExchange ? 'currency_exchange' : (t.esDebito ? 'arrow_upward' : 'arrow_downward');
        const detalle = t.esExchange ? `${t.origen} → ${t.destino}` : t.origen;
        const celdaMov = fila.insertCell();
        celdaMov.innerHTML = `
            <div class="movement-cell">
                <span class="material-icons ${t.esDebito ? 'is-debit' : 'is-credit'}">${icono}</span>
                <div class="movement-info">
                    <strong></strong>
                    <small></small>
                </div>
            </div>
        `;
        // textContent evita inyectar HTML desde datos guardados
        const info = celdaMov.querySelector('.movement-info');
        info.firstElementChild.textContent = t.descripcion;
        info.lastElementChild.textContent = detalle;

        const celdaTasa = fila.insertCell();
        celdaTasa.className = 'col-tasa';
        celdaTasa.textContent = t.tasaFormateada;

        const celdaMonto = fila.insertCell();
        celdaMonto.className = 'col-monto';
        if (t.esExchange) {
            celdaMonto.innerHTML = `<span class="valor-negativo"></span><span class="valor-positivo"></span>`;
            celdaMonto.firstElementChild.textContent = `− ${t.montoOrigenFormateado}`;
            celdaMonto.lastElementChild.textContent = `+ ${t.montoDestinoFormateado}`;
        } else {
            const span = document.createElement('span');
            span.className = t.esDebito ? 'valor-negativo' : 'valor-positivo';
            span.textContent = `${t.esDebito ? '−' : '+'} ${t.montoOrigenFormateado}`;
            celdaMonto.appendChild(span);
        }
        return fila;
    }

    irAMovimientos() {
        if (this.selectFiltro && !this.selectFiltro.value) {
            this.selectFiltro.value = ExchangeController.FILTRO_TODOS;
        }
        this.renderizarTabla();
        const seccion = this.contenedorMovimientos?.closest('.movements-section');
        seccion?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        seccion?.classList.add('section-focus');
        setTimeout(() => seccion?.classList.remove('section-focus'), 1200);
    }
}
