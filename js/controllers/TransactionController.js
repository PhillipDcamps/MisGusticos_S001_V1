// js/controllers/TransactionController.js
class TransactionController {
    constructor() {
        this.cliente = AuthService.obtenerClienteActual();
        
        if (!this.cliente) {
            window.location.href = 'iniciarSesion.html';
            return;
        }

        this.inicializarEventListeners();
        this.cargarDatosCliente();
    }

    inicializarEventListeners() {
        // Cerrar sesión
        document.getElementById('btn-logout')?.addEventListener('click', () => {
            AuthService.logout();
            window.location.href = 'iniciarSesion.html';
        });

        // Abrir modales
        document.getElementById('btn-consignar')?.addEventListener('click', () => this.abrirModal('modal-consignar'));
        document.getElementById('btn-retirar')?.addEventListener('click', () => this.abrirModal('modal-retirar'));
        document.getElementById('btn-transferir')?.addEventListener('click', () => this.abrirModal('modal-transferir'));
        document.getElementById('btn-comprar')?.addEventListener('click', () => this.abrirModal('modal-comprar'));
        document.getElementById('btn-movimientos')?.addEventListener('click', () => this.abrirModal('modal-movimientos'));
        document.getElementById('btn-perfil')?.addEventListener('click', () => {
            window.location.href = 'perfil.html';
        });

        // Cerrar modales
        document.querySelectorAll('.modal-close').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const modalId = e.currentTarget.dataset.close;
                document.getElementById(modalId).style.display = 'none';
            });
        });

        // Formularios
        document.getElementById('form-consignar')?.addEventListener('submit', (e) => this.consignar(e));
        document.getElementById('form-retirar')?.addEventListener('submit', (e) => this.retirar(e));
        document.getElementById('form-transferir')?.addEventListener('submit', (e) => this.transferir(e));
        document.getElementById('form-comprar')?.addEventListener('submit', (e) => this.comprar(e));
        document.getElementById('btn-ver-movimientos')?.addEventListener('click', () => this.verMovimientos());

        // Calcular cuota en tiempo real
        document.getElementById('monto-comprar')?.addEventListener('input', () => this.calcularCuotaPreview());
        document.getElementById('cuotas-comprar')?.addEventListener('change', () => this.calcularCuotaPreview());
    }

    cargarDatosCliente() {
        // Saludo personalizado
        const nombre = this.cliente.nombre.split(' ')[0];
        document.getElementById('nombre-cliente').textContent = `Hola, ${nombre} 👋`;
        
        this.llenarSelectoresCuentas();
        this.actualizarSaldos();

        // Agregar botón de administración
    const btnAdmin = document.createElement('button');
    btnAdmin.id = 'btn-admin';
    btnAdmin.className = 'action-button';
    btnAdmin.innerHTML = `
        <span class="material-icons">admin_panel_settings</span>
        <span>Administrar</span>
    `;
    btnAdmin.addEventListener('click', () => {
        window.location.href = 'admin.html';
    });
    document.querySelector('.action-buttons')?.appendChild(btnAdmin);
    
    }

    llenarSelectoresCuentas() {
        const selectores = [
            'cuenta-consignar', 'cuenta-retirar', 'cuenta-origen', 
            'cuenta-comprar', 'cuenta-movimientos'
        ];
        
        selectores.forEach(id => {
            const select = document.getElementById(id);
            if (select) {
                select.innerHTML = '<option value="">Seleccione una cuenta</option>';
                this.cliente.cuentas.forEach(cuenta => {
                    // Solo mostrar tarjetas en el selector de compras
                    if (id === 'cuenta-comprar' && cuenta.tipo !== 'credito') return;
                    
                    const option = document.createElement('option');
                    option.value = cuenta.numeroCuenta;
                    option.textContent = `${this.getNombreTipo(cuenta.tipo)} - ${cuenta.numeroCuenta}`;
                    select.appendChild(option);
                });
            }
        });
    }

    getNombreTipo(tipo) {
        const nombres = {
            'ahorros': '💰 Ahorros',
            'corriente': '💳 Corriente',
            'credito': '🏦 Tarjeta Crédito'
        };
        return nombres[tipo] || tipo;
    }

    actualizarSaldos() {
        const contenedor = document.getElementById('lista-saldos');
        if (!contenedor) return;

        contenedor.innerHTML = '';
        this.cliente.cuentas.forEach(cuenta => {
            const div = document.createElement('div');
            div.className = 'balance-card';
            
            let saldoTexto = '';
            if (cuenta.tipo === 'credito') {
                saldoTexto = `
                    <p class="balance-label">Cupo disponible</p>
                    <p class="balance-amount">$ ${cuenta.cupoDisponible.toLocaleString('es-CO')}</p>
                    <p class="balance-sub">Cupo total: $ ${cuenta.cupoTotal.toLocaleString('es-CO')}</p>
                `;
            } else {
                saldoTexto = `
                    <p class="balance-label">Saldo disponible</p>
                    <p class="balance-amount">$ ${cuenta.saldo.toLocaleString('es-CO', {minimumFractionDigits: 2})}</p>
                `;
            }
            
            div.innerHTML = `
                <div class="balance-header">
                    <span class="material-icons">${this.getIconoTipo(cuenta.tipo)}</span>
                    <span>${this.getNombreTipo(cuenta.tipo)}</span>
                </div>
                ${saldoTexto}
                <p class="balance-account">Cuenta • ${cuenta.numeroCuenta.slice(-4)}</p>
            `;
            contenedor.appendChild(div);
        });
    }

    getIconoTipo(tipo) {
        const iconos = {
            'ahorros': 'savings',
            'corriente': 'account_balance_wallet',
            'credito': 'credit_card'
        };
        return iconos[tipo] || 'account_balance';
    }

    abrirModal(modalId) {
        document.getElementById(modalId).style.display = 'flex';
    }

    consignar(event) {
        event.preventDefault();
        const numeroCuenta = document.getElementById('cuenta-consignar').value;
        const monto = parseFloat(document.getElementById('monto-consignar').value);

        try {
            const resultado = TransactionService.consignar(this.cliente, numeroCuenta, monto);
            this.mostrarMensaje(resultado.mensaje, 'success');
            this.actualizarSaldos();
            event.target.reset();
            document.getElementById('modal-consignar').style.display = 'none';
        } catch (error) {
            this.mostrarMensaje(error.message, 'error');
        }
    }

    retirar(event) {
        event.preventDefault();
        const numeroCuenta = document.getElementById('cuenta-retirar').value;
        const monto = parseFloat(document.getElementById('monto-retirar').value);

        try {
            const resultado = TransactionService.retirar(this.cliente, numeroCuenta, monto);
            
            let mensajeExtra = '';
            if (resultado.detalles.interesAplicado) {
                mensajeExtra = ` (Interés aplicado: $${resultado.detalles.interesAplicado.toFixed(2)})`;
            }
            if (resultado.detalles.sobregiroUtilizado > 0) {
                mensajeExtra = ` (Sobregiro usado: $${resultado.detalles.sobregiroUtilizado.toFixed(2)})`;
            }
            
            this.mostrarMensaje(resultado.mensaje + mensajeExtra, 'success');
            this.actualizarSaldos();
            event.target.reset();
            document.getElementById('modal-retirar').style.display = 'none';
        } catch (error) {
            this.mostrarMensaje(error.message, 'error');
        }
    }

    transferir(event) {
        event.preventDefault();
        const cuentaOrigenNum = document.getElementById('cuenta-origen').value;
        const cuentaDestinoNum = document.getElementById('cuenta-destino').value.trim();
        const monto = parseFloat(document.getElementById('monto-transferir').value);

        const cuentaOrigen = this.cliente.cuentas.find(c => c.numeroCuenta === cuentaOrigenNum);

        try {
            const resultado = TransactionService.transferir(
                this.cliente, cuentaOrigen, cuentaDestinoNum, monto
            );
            this.mostrarMensaje(resultado.mensaje, 'success');
            this.actualizarSaldos();
            event.target.reset();
            document.getElementById('modal-transferir').style.display = 'none';
        } catch (error) {
            this.mostrarMensaje(error.message, 'error');
        }
    }

    comprar(event) {
        event.preventDefault();
        const numeroTarjeta = document.getElementById('cuenta-comprar').value;
        const monto = parseFloat(document.getElementById('monto-comprar').value);
        const cuotas = parseInt(document.getElementById('cuotas-comprar').value);

        try {
            const resultado = TransactionService.comprarConTarjeta(
                this.cliente, numeroTarjeta, monto, cuotas
            );
            
            this.mostrarMensaje(
                `✅ Compra exitosa. Cuota mensual: $${resultado.cuotaMensual.toFixed(2)} | Tasa: ${(resultado.tasaAplicada*100).toFixed(1)}%`, 
                'success'
            );
            this.actualizarSaldos();
            event.target.reset();
            document.getElementById('resultado-cuota').style.display = 'none';
            document.getElementById('modal-comprar').style.display = 'none';
        } catch (error) {
            this.mostrarMensaje(error.message, 'error');
        }
    }

    calcularCuotaPreview() {
        const monto = parseFloat(document.getElementById('monto-comprar').value) || 0;
        const cuotas = parseInt(document.getElementById('cuotas-comprar').value);
        const infoBox = document.getElementById('resultado-cuota');
        const valorCuota = document.getElementById('valor-cuota');
        
        if (monto > 0 && cuotas > 0) {
            let tasa = 0;
            if (cuotas <= 2) tasa = 0;
            else if (cuotas <= 6) tasa = 0.019;
            else tasa = 0.023;
            
            let cuota;
            if (tasa === 0) {
                cuota = monto / cuotas;
            } else {
                cuota = (monto * tasa) / (1 - Math.pow(1 + tasa, -cuotas));
            }
            
            valorCuota.textContent = `$ ${cuota.toLocaleString('es-CO', {minimumFractionDigits: 2})}`;
            infoBox.style.display = 'block';
        } else {
            infoBox.style.display = 'none';
        }
    }

    verMovimientos() {
        const numeroCuenta = document.getElementById('cuenta-movimientos').value;
        if (!numeroCuenta) {
            this.mostrarMensaje('Selecciona una cuenta', 'error');
            return;
        }

        try {
            const movimientos = TransactionService.obtenerMovimientos(this.cliente, numeroCuenta);
            this.renderizarMovimientosModal(movimientos);
            this.abrirModal('modal-movimientos');
        } catch (error) {
            this.mostrarMensaje(error.message, 'error');
        }
    }

    renderizarMovimientosModal(movimientos) {
        const contenedor = document.getElementById('lista-movimientos-modal');
        if (!contenedor) return;

        if (movimientos.length === 0) {
            contenedor.innerHTML = '<p class="empty-state">Sin movimientos aún.</p>';
            return;
        }

        contenedor.innerHTML = '';
        movimientos.forEach(mov => {
            const div = document.createElement('div');
            div.className = 'movement-item';
            const icono = mov.tipo.toLowerCase().includes('retiro') || mov.tipo.toLowerCase().includes('compra') 
                ? 'arrow_upward' : 'arrow_downward';
            const claseValor = mov.tipo.toLowerCase().includes('retiro') || mov.tipo.toLowerCase().includes('compra')
                ? 'valor-negativo' : 'valor-positivo';
            
            div.innerHTML = `
                <span class="material-icons">${icono}</span>
                <div class="movement-info">
                    <strong>${mov.tipo}</strong>
                    <small>${new Date(mov.fecha).toLocaleString('es-CO')}</small>
                </div>
                <span class="${claseValor}">$ ${mov.valor.toLocaleString('es-CO', {minimumFractionDigits: 2})}</span>
            `;
            contenedor.appendChild(div);
        });
    }

    mostrarMensaje(mensaje, tipo) {
        const contenedor = document.getElementById('mensaje-panel');
        if (contenedor) {
            contenedor.textContent = mensaje;
            contenedor.className = `mensaje-feedback mensaje-${tipo}`;
            contenedor.style.display = 'block';
            
            setTimeout(() => {
                contenedor.style.display = 'none';
            }, 5000);
        }
    }
}