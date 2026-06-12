CREATE TABLE usuario (
    id_usuario SERIAL PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL,
    apellido_paterno VARCHAR(100),
    apellido_materno VARCHAR(100),
    usuario VARCHAR(50) UNIQUE NOT NULL,
    correo VARCHAR(120) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    estado VARCHAR(20) DEFAULT 'Activo',
    fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE categoria (
    id_categoria SERIAL PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL,
    descripcion TEXT,
    estado VARCHAR(20) DEFAULT 'Activo'
);

CREATE TABLE marca (
    id_marca SERIAL PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL,
    descripcion TEXT,
    estado VARCHAR(20) DEFAULT 'Activo'
);

CREATE TABLE proveedor (
    id_proveedor SERIAL PRIMARY KEY,
    nombre VARCHAR(100),
    apellido_paterno VARCHAR(100),
    apellido_materno VARCHAR(100),
    razon_social VARCHAR(150),
    rfc_identificacion VARCHAR(30) UNIQUE,
    telefono VARCHAR(30),
    correo_electronico VARCHAR(120),
    estado VARCHAR(20) DEFAULT 'Activo'
);

CREATE TABLE producto (
    id_producto SERIAL PRIMARY KEY,
    codigo_barras VARCHAR(50) UNIQUE NOT NULL,
    nombre VARCHAR(150) NOT NULL,
    descripcion TEXT,
    id_categoria INT REFERENCES categoria(id_categoria),
    id_marca INT REFERENCES marca(id_marca),
    precio_venta DECIMAL(10,2) NOT NULL,
    stock_actual INT DEFAULT 0,
    stock_minimo INT DEFAULT 0,
    estado VARCHAR(20) DEFAULT 'Activo'
);

CREATE TABLE entrada_inventario (
    id_entrada_inventario SERIAL PRIMARY KEY,
    id_proveedor INT NOT NULL,
    fecha_entrada TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    observaciones TEXT,
    id_usuario INT NOT NULL,

    CONSTRAINT fk_entrada_proveedor
        FOREIGN KEY (id_proveedor)
        REFERENCES proveedor(id_proveedor),

    CONSTRAINT fk_entrada_usuario
        FOREIGN KEY (id_usuario)
        REFERENCES usuario(id_usuario)
);

CREATE TABLE detalle_entrada_inventario (
    id_detalle_entrada SERIAL PRIMARY KEY,
    id_entrada_inventario INT NOT NULL,
    id_producto INT NOT NULL,
    cantidad INT NOT NULL,
    costo_unitario DECIMAL(10,2) NOT NULL,
    subtotal DECIMAL(10,2) NOT NULL,

    CONSTRAINT fk_detalle_entrada
        FOREIGN KEY (id_entrada_inventario)
        REFERENCES entrada_inventario(id_entrada_inventario),

    CONSTRAINT fk_detalle_producto
        FOREIGN KEY (id_producto)
        REFERENCES producto(id_producto)
);

CREATE TABLE caja (
    id_caja SERIAL PRIMARY KEY,
    fecha DATE NOT NULL,
    hora_apertura TIMESTAMP NOT NULL,
    hora_cierre TIMESTAMP,
    monto_inicial DECIMAL(12,2) NOT NULL,
    ventas_calculadas DECIMAL(12,2) DEFAULT 0,
    efectivo_declarado DECIMAL(12,2),
    diferencia DECIMAL(12,2),
    observaciones TEXT,
    estado VARCHAR(20) DEFAULT 'Abierta',
    id_usuario INT NOT NULL,

    CONSTRAINT fk_caja_usuario
        FOREIGN KEY (id_usuario)
        REFERENCES usuario(id_usuario)
);

CREATE TABLE venta (
    id_venta SERIAL PRIMARY KEY,
    folio VARCHAR(50) UNIQUE NOT NULL,
    fecha_venta TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    subtotal DECIMAL(12,2) NOT NULL,
    iva DECIMAL(12,2) NOT NULL,
    total DECIMAL(12,2) NOT NULL,
    estado VARCHAR(20) DEFAULT 'Completada',
    id_usuario INT NOT NULL,
    id_caja INT NOT NULL,

    CONSTRAINT fk_venta_usuario
        FOREIGN KEY (id_usuario)
        REFERENCES usuario(id_usuario),

    CONSTRAINT fk_venta_caja
        FOREIGN KEY (id_caja)
        REFERENCES caja(id_caja)
);

CREATE TABLE detalle_venta (
    id_detalle_venta SERIAL PRIMARY KEY,
    id_venta INT NOT NULL,
    id_producto INT NOT NULL,
    cantidad INT NOT NULL,
    precio_unitario DECIMAL(10,2) NOT NULL,
    subtotal DECIMAL(10,2) NOT NULL,

    CONSTRAINT fk_detalle_venta
        FOREIGN KEY (id_venta)
        REFERENCES venta(id_venta),

    CONSTRAINT fk_detalle_producto_venta
        FOREIGN KEY (id_producto)
        REFERENCES producto(id_producto)
);

CREATE TABLE metodo_pago (
    id_metodo_pago SERIAL PRIMARY KEY,
    nombre VARCHAR(50) NOT NULL
);

CREATE TABLE pago_venta (
    id_pago SERIAL PRIMARY KEY,
    id_venta INT NOT NULL,
    id_metodo_pago INT NOT NULL,
    monto DECIMAL(12,2) NOT NULL,
    dinero_recibido DECIMAL(12,2),
    cambio DECIMAL(12,2),
    referencia VARCHAR(100),
    fecha_pago TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_pago_venta
        FOREIGN KEY (id_venta)
        REFERENCES venta(id_venta),

    CONSTRAINT fk_pago_metodo
        FOREIGN KEY (id_metodo_pago)
        REFERENCES metodo_pago(id_metodo_pago)
);

CREATE INDEX idx_producto_codigo_barras ON producto(codigo_barras);
CREATE INDEX idx_producto_nombre ON producto(nombre);
CREATE INDEX idx_venta_fecha ON venta(fecha_venta);
CREATE INDEX idx_kardex_producto ON kardex(id_producto);
CREATE INDEX idx_kardex_fecha ON kardex(fecha_movimiento);
CREATE INDEX idx_detalle_venta_producto ON detalle_venta(id_producto);
CREATE INDEX idx_pago_venta ON pago_venta(id_venta);