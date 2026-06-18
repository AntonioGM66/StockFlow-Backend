require('dotenv').config();

const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');

const app = express();

app.use(cors());
app.use(express.json());

// Configuración de PostgreSQL
const pool = new Pool({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME
});

// Ruta principal
app.get('/', (req, res) => {
    res.send('Servidor funcionando 🚀');
});

// Ruta para probar conexión con PostgreSQL
app.get('/db-test', async (req, res) => {
    try {
        const result = await pool.query('SELECT NOW()');
        res.json(result.rows);
    } catch (error) {
        console.error(error);
        res.status(500).send('Error en la conexión');
    }
});

// Crear producto
app.post('/productos', async (req, res) => {
    try {
        const {
            codigoBarras,
            nombre,
            descripcion,
            idCategoria,
            idMarca,
            precioVenta,
            stockActual,
            stockMinimo
        } = req.body;

        const codigoExistente = await pool.query(
            'SELECT * FROM producto WHERE codigo_barras = $1',
            [codigoBarras]
        );

        if (codigoExistente.rows.length > 0) {
            return res.status(409).json({
                success: false,
                message: 'Código de barras ya registrado'
            });
        }

        const result = await pool.query(
            `INSERT INTO producto (
                codigo_barras,
                nombre,
                descripcion,
                id_categoria,
                id_marca,
                precio_venta,
                stock_actual,
                stock_minimo,
                estado
            )
            VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
            RETURNING *`,
            [
                codigoBarras,
                nombre,
                descripcion,
                idCategoria,
                idMarca,
                precioVenta,
                stockActual,
                stockMinimo,
                'Activo'
            ]
        );

        res.json({
            success: true,
            producto: result.rows[0]
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({
            success: false,
            message: 'Error al registrar producto'
        });
    }
});

const PORT = process.env.PORT || 4000;

// Login de usuario
app.post('/login', async (req, res) => {
    try {
        const { usuario, password } = req.body;

        const result = await pool.query(
            'SELECT * FROM usuario WHERE usuario = $1 AND password_hash = $2 AND estado = $3',
            [usuario, password, 'Activo']
        );

        if (result.rows.length === 0) {
            return res.status(401).json({
                success: false,
                message: 'Usuario o contraseña inválidos'
            });
        }

        res.json({
            success: true,
            message: 'Acceso correcto',
            usuario: result.rows[0]
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({
            success: false,
            message: 'Error en el servidor'
        });
    }
});

// Crear cuenta de usuario
app.post('/usuarios', async (req, res) => {
    try {
        const {
            nombre,
            apellidoPaterno,
            apellidoMaterno,
            usuario,
            correo,
            password,
            confirmarPassword
} = req.body;

        if (!nombre || !apellidoPaterno || !apellidoMaterno || !usuario || !correo || !password || !confirmarPassword) {
            return res.status(400).json({
                success: false,
                message: 'Todos los campos son obligatorios'
            });
        }

        if (password !== confirmarPassword) {
            return res.status(400).json({
                success: false,
                message: 'Las contraseñas no coinciden'
            });
        }

        const usuarioExistente = await pool.query(
            'SELECT * FROM usuario WHERE usuario = $1 OR correo = $2',
            [usuario, correo]
        );

        if (usuarioExistente.rows.length > 0) {
            return res.status(409).json({
                success: false,
                message: 'El usuario o correo ya existe'
            });
        }

const result = await pool.query(
    `INSERT INTO usuario (
        nombre,
        apellido_paterno,
        apellido_materno,
        usuario,
        correo,
        password_hash,
        estado
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7)
    RETURNING id_usuario, nombre, apellido_paterno, apellido_materno, usuario, correo, estado`,
    [
        nombre,
        apellidoPaterno,
        apellidoMaterno,
        usuario,
        correo,
        password,
        'Activo'
    ]
);

        res.json({
            success: true,
            message: 'Cuenta creada exitosamente',
            usuario: result.rows[0]
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({
            success: false,
            message: 'Error al crear la cuenta'
        });
    }
});

// Verificar correo para recuperación
app.post('/recuperar-password', async (req, res) => {
    try {
        const { correo } = req.body;

        const result = await pool.query(
            'SELECT id_usuario, correo FROM usuario WHERE correo = $1 AND estado = $2',
            [correo, 'Activo']
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Correo no registrado'
            });
        }

        res.json({
            success: true,
            message: 'Correo verificado correctamente',
            correo: result.rows[0].correo
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({
            success: false,
            message: 'Error en el servidor'
        });
    }
});

// Cambiar contraseña
app.put('/cambiar-password', async (req, res) => {
    try {
        const { correo, nuevaPassword, confirmarPassword } = req.body;

        if (nuevaPassword !== confirmarPassword) {
            return res.status(400).json({
                success: false,
                message: 'Las contraseñas no coinciden'
            });
        }

        await pool.query(
            'UPDATE usuario SET password_hash = $1 WHERE correo = $2',
            [nuevaPassword, correo]
        );

        res.json({
            success: true,
            message: 'Contraseña actualizada correctamente'
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({
            success: false,
            message: 'Error al cambiar contraseña'
        });
    }
});

// Indicadores del dashboard
app.get('/dashboard/resumen', async (req, res) => {
    try {
        const totalProductos = await pool.query(
            'SELECT COUNT(*) AS total FROM producto WHERE estado = $1',
            ['Activo']
        );

        const productosBajoStock = await pool.query(
            'SELECT COUNT(*) AS total FROM producto WHERE stock_actual <= stock_minimo AND estado = $1',
            ['Activo']
        );

        const ventasDia = await pool.query(
            `SELECT COALESCE(SUM(total), 0) AS total
            FROM venta
            WHERE DATE(fecha_venta) = CURRENT_DATE
            AND estado = 'Completada'`
        );

        res.json({
            totalProductos: totalProductos.rows[0].total,
            ventasDia: ventasDia.rows[0].total,
            productosBajoStock: productosBajoStock.rows[0].total
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ mensaje: 'Error al obtener resumen del dashboard' });
    }
});

// Obtener categorías
app.get('/categorias', async (req, res) => {
    try {
        const result = await pool.query(
            'SELECT * FROM categoria ORDER BY nombre'
        );

        res.json(result.rows);

    } catch (error) {
        console.error(error);
        res.status(500).send('Error al obtener categorías');
    }
});

// Obtener marcas
app.get('/marcas', async (req, res) => {
    try {
        const result = await pool.query(
            'SELECT * FROM marca ORDER BY nombre'
        );

        res.json(result.rows);

    } catch (error) {
        console.error(error);
        res.status(500).json({
            success: false,
            message: 'Error al obtener marcas'
        });
    }
});

// Consultar productos
app.get('/productos', async (req, res) => {
    try {
        const { buscar } = req.query;

        let query = `
            SELECT
                p.id_producto,
                p.codigo_barras,
                p.nombre,
                p.descripcion,
                p.id_categoria,
                p.id_marca,
                c.nombre AS categoria,
                m.nombre AS marca,
                p.precio_venta,
                p.stock_actual,
                p.stock_minimo,
                p.estado
            FROM producto p
            LEFT JOIN categoria c ON p.id_categoria = c.id_categoria
            LEFT JOIN marca m ON p.id_marca = m.id_marca
        `;

        let params = [];

        if (buscar) {
            query += `
                WHERE p.nombre ILIKE $1
                OR p.codigo_barras ILIKE $1
            `;
            params.push(`%${buscar}%`);
        }

        query += ` ORDER BY p.id_producto`;

        const result = await pool.query(query, params);

        res.json(result.rows);

    } catch (error) {
        console.error(error);
        res.status(500).json({
            success: false,
            message: 'Error al obtener productos'
        });
    }
});

// Editar producto
app.put('/productos/:id', async (req, res) => {
    try {
        const { id } = req.params;

        const {
            codigoBarras,
            nombre,
            descripcion,
            idCategoria,
            idMarca,
            precioVenta,
            stockActual,
            stockMinimo
        } = req.body;

        const codigoExistente = await pool.query(
            `SELECT * FROM producto 
            WHERE codigo_barras = $1 
            AND id_producto <> $2`,
            [codigoBarras, id]
        );

        if (codigoExistente.rows.length > 0) {
            return res.status(409).json({
                success: false,
                message: 'Código de barras ya registrado en otro producto'
            });
        }

        const result = await pool.query(
            `UPDATE producto SET
                codigo_barras = $1,
                nombre = $2,
                descripcion = $3,
                id_categoria = $4,
                id_marca = $5,
                precio_venta = $6,
                stock_actual = $7,
                stock_minimo = $8
            WHERE id_producto = $9
             RETURNING *`,
            [
                codigoBarras,
                nombre,
                descripcion,
                idCategoria,
                idMarca,
                precioVenta,
                stockActual,
                stockMinimo,
                id
            ]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Producto no encontrado'
            });
        }

        res.json({
            success: true,
            message: 'Producto actualizado correctamente',
            producto: result.rows[0]
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({
            success: false,
            message: 'Error al actualizar producto'
        });
    }
});

// Activar / Desactivar producto
app.put('/productos/:id/estado', async (req, res) => {
    try {
        const { id } = req.params;
        const { estado } = req.body;

        const nuevoEstado = estado === 'Activo' ? 'Inactivo' : 'Activo';

        const result = await pool.query(
            `UPDATE producto
            SET estado = $1
            WHERE id_producto = $2
             RETURNING *`,
            [nuevoEstado, id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Producto no encontrado'
            });
        }

        res.json({
            success: true,
            message: `Producto ${nuevoEstado.toLowerCase()} correctamente`,
            producto: result.rows[0]
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({
            success: false,
            message: 'Error al cambiar estado del producto'
        });
    }
});

// Crear categoría
app.post('/categorias', async (req, res) => {
    try {
        const { nombre, descripcion } = req.body;
        const nombreLimpio = typeof nombre === 'string' ? nombre.trim() : '';
        const descripcionLimpia = typeof descripcion === 'string' ? descripcion.trim() : '';

        if (!nombreLimpio) {
            return res.status(400).json({
                success: false,
                message: 'El nombre de la categoría es obligatorio'
            });
        }

        const categoriaExistente = await pool.query(
            'SELECT id_categoria FROM categoria WHERE LOWER(nombre) = LOWER($1)',
            [nombreLimpio]
        );

        if (categoriaExistente.rows.length > 0) {
            return res.status(409).json({
                success: false,
                message: 'Ya existe una categoría con ese nombre'
            });
        }

        const result = await pool.query(
            `INSERT INTO categoria (nombre, descripcion, estado)
            VALUES ($1, $2, $3)
             RETURNING *`,
            [nombreLimpio, descripcionLimpia || null, 'Activo']
        );

        res.status(201).json({
            success: true,
            message: 'Categoría guardada correctamente',
            categoria: result.rows[0]
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({
            success: false,
            message: 'Error al guardar categoría'
        });
    }
});

// Editar categoría
app.put('/categorias/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { nombre, descripcion } = req.body;
        const nombreLimpio = typeof nombre === 'string' ? nombre.trim() : '';
        const descripcionLimpia = typeof descripcion === 'string' ? descripcion.trim() : '';

        if (!nombreLimpio) {
            return res.status(400).json({
                success: false,
                message: 'El nombre de la categoría es obligatorio'
            });
        }

        const categoriaExistente = await pool.query(
            `SELECT id_categoria
            FROM categoria
            WHERE LOWER(nombre) = LOWER($1)
            AND id_categoria <> $2`,
            [nombreLimpio, id]
        );

        if (categoriaExistente.rows.length > 0) {
            return res.status(409).json({
                success: false,
                message: 'Ya existe otra categoría con ese nombre'
            });
        }

        const result = await pool.query(
            `UPDATE categoria
            SET nombre = $1,
                descripcion = $2
            WHERE id_categoria = $3
             RETURNING *`,
            [nombreLimpio, descripcionLimpia || null, id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Categoría no encontrada'
            });
        }

        res.json({
            success: true,
            message: 'Categoría actualizada correctamente',
            categoria: result.rows[0]
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({
            success: false,
            message: 'Error al actualizar categoría'
        });
    }
});

// Activar / Desactivar categoría
app.put('/categorias/:id/estado', async (req, res) => {
    try {
        const { id } = req.params;

        const result = await pool.query(
            `UPDATE categoria
            SET estado = CASE
                WHEN estado = 'Activo' THEN 'Inactivo'
                ELSE 'Activo'
            END
            WHERE id_categoria = $1
             RETURNING *`,
            [id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Categoría no encontrada'
            });
        }

        const nuevoEstado = result.rows[0].estado;

        res.json({
            success: true,
            message: `Categoría ${nuevoEstado.toLowerCase()} correctamente`,
            categoria: result.rows[0]
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({
            success: false,
            message: 'Error al cambiar estado de categoría'
        });
    }
});

// Crear marca
app.post('/marcas', async (req, res) => {
    try {
        const { nombre, descripcion } = req.body;
        const nombreLimpio = typeof nombre === 'string' ? nombre.trim() : '';
        const descripcionLimpia = typeof descripcion === 'string' ? descripcion.trim() : '';

        if (!nombreLimpio) {
            return res.status(400).json({
                success: false,
                message: 'El nombre de la marca es obligatorio'
            });
        }

        const marcaExistente = await pool.query(
            'SELECT id_marca FROM marca WHERE LOWER(nombre) = LOWER($1)',
            [nombreLimpio]
        );

        if (marcaExistente.rows.length > 0) {
            return res.status(409).json({
                success: false,
                message: 'Ya existe una marca con ese nombre'
            });
        }

        const result = await pool.query(
            `INSERT INTO marca (nombre, descripcion, estado)
             VALUES ($1, $2, $3)
             RETURNING *`,
            [nombreLimpio, descripcionLimpia || null, 'Activo']
        );

        res.status(201).json({
            success: true,
            message: 'Marca guardada correctamente',
            marca: result.rows[0]
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({
            success: false,
            message: 'Error al guardar marca'
        });
    }
});

// Editar marca
app.put('/marcas/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { nombre, descripcion } = req.body;
        const nombreLimpio = typeof nombre === 'string' ? nombre.trim() : '';
        const descripcionLimpia = typeof descripcion === 'string' ? descripcion.trim() : '';

        if (!nombreLimpio) {
            return res.status(400).json({
                success: false,
                message: 'El nombre de la marca es obligatorio'
            });
        }

        const marcaExistente = await pool.query(
            `SELECT id_marca
            FROM marca
            WHERE LOWER(nombre) = LOWER($1)
            AND id_marca <> $2`,
            [nombreLimpio, id]
        );

        if (marcaExistente.rows.length > 0) {
            return res.status(409).json({
                success: false,
                message: 'Ya existe otra marca con ese nombre'
            });
        }

        const result = await pool.query(
            `UPDATE marca
            SET nombre = $1,
                descripcion = $2
            WHERE id_marca = $3
             RETURNING *`,
            [nombreLimpio, descripcionLimpia || null, id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Marca no encontrada'
            });
        }

        res.json({
            success: true,
            message: 'Marca actualizada correctamente',
            marca: result.rows[0]
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({
            success: false,
            message: 'Error al actualizar marca'
        });
    }
});

// Activar / Desactivar marca
app.put('/marcas/:id/estado', async (req, res) => {
    try {
        const { id } = req.params;

        const result = await pool.query(
            `UPDATE marca
            SET estado = CASE
                WHEN estado = 'Activo' THEN 'Inactivo'
                ELSE 'Activo'
            END
            WHERE id_marca = $1
             RETURNING *`,
            [id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Marca no encontrada'
            });
        }

        const nuevoEstado = result.rows[0].estado;

        res.json({
            success: true,
            message: `Marca ${nuevoEstado.toLowerCase()} correctamente`,
            marca: result.rows[0]
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({
            success: false,
            message: 'Error al cambiar estado de marca'
        });
    }
});

// Rutas para proveedores
app.get('/proveedores', async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT
                id_provedor AS id_proveedor,
                nombre,
                apellido_paterno,
                apellido_materno,
                razon_social,
                rfc_identificacion,
                telefono,
                correo_electronico,
                estado
            FROM proveedor
            ORDER BY id_provedor`
        );
        res.json(result.rows);
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Error al obtener proveedores' });
    }
});

app.post('/proveedores', async (req, res) => {
    try {
        const { razonSocial, rfc, telefono, correo } = req.body;
        const razonSocialLimpia = typeof razonSocial === 'string' ? razonSocial.trim() : '';
        const rfcLimpio = typeof rfc === 'string' ? rfc.trim() : '';
        const telefonoLimpio = typeof telefono === 'string' ? telefono.trim() : '';
        const correoLimpio = typeof correo === 'string' ? correo.trim() : '';

        if (!razonSocialLimpia || !rfcLimpio) {
            return res.status(400).json({
                success: false,
                message: 'La razón social y el RFC son obligatorios'
            });
        }

        const proveedorExistente = await pool.query(
            'SELECT id_provedor FROM proveedor WHERE UPPER(rfc_identificacion) = UPPER($1)',
            [rfcLimpio]
        );

        if (proveedorExistente.rows.length > 0) {
            return res.status(409).json({
                success: false,
                message: 'Ya existe un proveedor con ese RFC'
            });
        }

        const result = await pool.query(
            `INSERT INTO proveedor (razon_social, rfc_identificacion, telefono, correo_electronico, estado)
             VALUES ($1, $2, $3, $4, $5)
             RETURNING id_provedor AS id_proveedor, razon_social, rfc_identificacion,
                       telefono, correo_electronico, estado`,
            [
                razonSocialLimpia,
                rfcLimpio,
                telefonoLimpio || null,
                correoLimpio || null,
                'Activo'
            ]
        );

        res.status(201).json({ success: true, message: 'Proveedor guardado correctamente', proveedor: result.rows[0] });

    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Error al guardar proveedor' });
    }
});

app.put('/proveedores/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { razonSocial, rfc, telefono, correo } = req.body;
        const razonSocialLimpia = typeof razonSocial === 'string' ? razonSocial.trim() : '';
        const rfcLimpio = typeof rfc === 'string' ? rfc.trim() : '';
        const telefonoLimpio = typeof telefono === 'string' ? telefono.trim() : '';
        const correoLimpio = typeof correo === 'string' ? correo.trim() : '';

        if (!razonSocialLimpia || !rfcLimpio) {
            return res.status(400).json({
                success: false,
                message: 'La razón social y el RFC son obligatorios'
            });
        }

        const proveedorExistente = await pool.query(
            `SELECT id_provedor
            FROM proveedor
            WHERE UPPER(rfc_identificacion) = UPPER($1)
            AND id_provedor <> $2`,
            [rfcLimpio, id]
        );

        if (proveedorExistente.rows.length > 0) {
            return res.status(409).json({
                success: false,
                message: 'Ya existe otro proveedor con ese RFC'
            });
        }

        const result = await pool.query(
            `UPDATE proveedor
             SET razon_social = $1,
                 rfc_identificacion = $2,
                 telefono = $3,
                 correo_electronico = $4
             WHERE id_provedor = $5
             RETURNING id_provedor AS id_proveedor, razon_social, rfc_identificacion,
                       telefono, correo_electronico, estado`,
            [
                razonSocialLimpia,
                rfcLimpio,
                telefonoLimpio || null,
                correoLimpio || null,
                id
            ]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Proveedor no encontrado'
            });
        }

        res.json({ success: true, message: 'Proveedor actualizado correctamente', proveedor: result.rows[0] });

    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Error al actualizar proveedor' });
    }
});

app.put('/proveedores/:id/estado', async (req, res) => {
    try {
        const { id } = req.params;

        const result = await pool.query(
            `UPDATE proveedor
             SET estado = CASE
                WHEN estado = 'Activo' THEN 'Inactivo'
                ELSE 'Activo'
             END
             WHERE id_provedor = $1
             RETURNING id_provedor AS id_proveedor, razon_social, rfc_identificacion,
                       telefono, correo_electronico, estado`,
            [id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Proveedor no encontrado'
            });
        }

        const nuevoEstado = result.rows[0].estado;

        res.json({ success: true, message: `Proveedor ${nuevoEstado.toLowerCase()} correctamente`, proveedor: result.rows[0] });

    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Error al cambiar estado del proveedor' });
    }
});

// Catálogos y resumen para inventario
app.get('/inventario/resumen', async (req, res) => {
    try {
        const [productos, unidades, bajoStock, agotados] = await Promise.all([
            pool.query(`SELECT COUNT(*) AS total FROM producto WHERE estado = 'Activo'`),
            pool.query(`SELECT COALESCE(SUM(stock_actual), 0) AS total FROM producto WHERE estado = 'Activo'`),
            pool.query(`SELECT COUNT(*) AS total
                        FROM producto
                        WHERE stock_actual <= stock_minimo AND stock_actual > 0
                        AND estado = 'Activo'`),
            pool.query(`SELECT COUNT(*) AS total
                        FROM producto
                        WHERE stock_actual <= 0 AND estado = 'Activo'`)
        ]);

        res.json({
            totalProductos: Number(productos.rows[0].total),
            totalUnidades: Number(unidades.rows[0].total),
            productosBajoStock: Number(bajoStock.rows[0].total),
            productosAgotados: Number(agotados.rows[0].total)
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({
            success: false,
            message: 'Error al obtener el resumen de inventario'
        });
    }
});

app.get('/inventario/catalogos', async (req, res) => {
    try {
        const [productos, proveedores] = await Promise.all([
            pool.query(
                `SELECT id_producto, codigo_barras, nombre, stock_actual, stock_minimo
                FROM producto
                WHERE estado = 'Activo'
                ORDER BY nombre`
            ),
            pool.query(
                `SELECT id_provedor AS id_proveedor, razon_social
                FROM proveedor
                WHERE estado = 'Activo'
                ORDER BY razon_social`
            )
        ]);

        res.json({
            productos: productos.rows,
            proveedores: proveedores.rows
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({
            success: false,
            message: 'Error al obtener los catálogos de inventario'
        });
    }
});

// Registrar una entrada y actualizar existencias de forma atómica
app.post('/inventario/entradas', async (req, res) => {
    const client = await pool.connect();

    try {
        const { idProveedor, idUsuario, observaciones, detalles } = req.body;
        const proveedorId = Number(idProveedor);
        const usuarioId = Number(idUsuario);

        if (
            !Number.isInteger(proveedorId) ||
            !Number.isInteger(usuarioId) ||
            !Array.isArray(detalles) ||
            detalles.length === 0
        ) {
            return res.status(400).json({
                success: false,
                message: 'Proveedor, usuario y al menos un producto son obligatorios'
            });
        }

        await client.query('BEGIN');

        const proveedor = await client.query(
            `SELECT id_provedor FROM proveedor
            WHERE id_provedor = $1 AND estado = 'Activo'`,
            [proveedorId]
        );

        if (proveedor.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({
                success: false,
                message: 'Proveedor no encontrado o inactivo'
            });
        }

        const entrada = await client.query(
            `INSERT INTO entrada_inventario
                (id_provedor, observaciones, id_usuario)
            VALUES ($1, $2, $3)
            RETURNING id_entrada_inventario, fecha_entrada`,
            [
                proveedorId,
                typeof observaciones === 'string' ? observaciones.trim() || null : null,
                usuarioId
            ]
        );

        const idEntrada = entrada.rows[0].id_entrada_inventario;
        const productosRegistrados = new Set();

        for (const detalle of detalles) {
            const idProducto = Number(detalle.idProducto);
            const cantidad = Number(detalle.cantidad);
            const costoUnitario = Number(detalle.costoUnitario);

            if (
                !Number.isInteger(idProducto) ||
                !Number.isInteger(cantidad) ||
                cantidad <= 0 ||
                !Number.isFinite(costoUnitario) ||
                costoUnitario < 0
            ) {
                throw new Error('Los datos de uno de los productos no son válidos');
            }

            if (productosRegistrados.has(idProducto)) {
                throw new Error('No se puede agregar el mismo producto dos veces');
            }

            productosRegistrados.add(idProducto);

            const producto = await client.query(
                `SELECT id_producto, stock_actual
                FROM producto
                WHERE id_producto = $1 AND estado = 'Activo'
                FOR UPDATE`,
                [idProducto]
            );

            if (producto.rows.length === 0) {
                throw new Error('Uno de los productos no existe o está inactivo');
            }

            const stockAnterior = Number(producto.rows[0].stock_actual);
            const stockResultante = stockAnterior + cantidad;
            const subtotal = cantidad * costoUnitario;

            await client.query(
                `INSERT INTO detalle_entrada_inventario
                    (id_entrada_inventario, id_producto, cantidad, costo_unitario, subtotal)
                VALUES ($1, $2, $3, $4, $5)`,
                [idEntrada, idProducto, cantidad, costoUnitario, subtotal]
            );

            await client.query(
                `UPDATE producto SET stock_actual = $1 WHERE id_producto = $2`,
                [stockResultante, idProducto]
            );

            await client.query(
                `INSERT INTO kardex
                    (id_producto, tipo_movimiento, cantidad, stock_anterior,
                     stock_resultante, referencia, id_usuario)
                VALUES ($1, $2, $3, $4, $5, $6, $7)`,
                [
                    idProducto,
                    'Entrada',
                    cantidad,
                    stockAnterior,
                    stockResultante,
                    `Entrada #${idEntrada}`,
                    usuarioId
                ]
            );
        }

        await client.query('COMMIT');

        res.status(201).json({
            success: true,
            message: 'Entrada registrada y existencias actualizadas correctamente',
            entrada: entrada.rows[0]
        });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error(error);
        res.status(400).json({
            success: false,
            message: error.message || 'Error al registrar la entrada de inventario'
        });
    } finally {
        client.release();
    }
});

app.get('/inventario/entradas', async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT
                e.id_entrada_inventario,
                e.fecha_entrada,
                p.nombre AS producto,
                pr.razon_social AS proveedor,
                d.cantidad,
                d.costo_unitario,
                d.subtotal
            FROM entrada_inventario e
            INNER JOIN detalle_entrada_inventario d
                ON d.id_entrada_inventario = e.id_entrada_inventario
            INNER JOIN producto p ON p.id_producto = d.id_producto
            INNER JOIN proveedor pr ON pr.id_provedor = e.id_provedor
            ORDER BY e.fecha_entrada DESC, d.id_detalle_entrada DESC
            LIMIT 100`
        );

        res.json(result.rows);
    } catch (error) {
        console.error(error);
        res.status(500).json({
            success: false,
            message: 'Error al consultar el historial de entradas'
        });
    }
});

// Ajuste manual controlado de existencias
app.post('/inventario/ajustes', async (req, res) => {
    const client = await pool.connect();

    try {
        const { idProducto, tipo, cantidad, motivo, idUsuario } = req.body;
        const productoId = Number(idProducto);
        const usuarioId = Number(idUsuario);
        const cantidadAjuste = Number(cantidad);
        const tipoNormalizado = typeof tipo === 'string' ? tipo.trim() : '';
        const motivoLimpio = typeof motivo === 'string' ? motivo.trim() : '';

        if (
            !Number.isInteger(productoId) ||
            !Number.isInteger(usuarioId) ||
            !Number.isInteger(cantidadAjuste) ||
            cantidadAjuste <= 0 ||
            !['Entrada', 'Salida'].includes(tipoNormalizado) ||
            !motivoLimpio
        ) {
            return res.status(400).json({
                success: false,
                message: 'Producto, tipo, cantidad, motivo y usuario son obligatorios'
            });
        }

        await client.query('BEGIN');

        const producto = await client.query(
            `SELECT id_producto, stock_actual
            FROM producto
            WHERE id_producto = $1 AND estado = 'Activo'
            FOR UPDATE`,
            [productoId]
        );

        if (producto.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({
                success: false,
                message: 'Producto no encontrado o inactivo'
            });
        }

        const stockAnterior = Number(producto.rows[0].stock_actual);
        const variacion = tipoNormalizado === 'Entrada' ? cantidadAjuste : -cantidadAjuste;
        const stockResultante = stockAnterior + variacion;

        if (stockResultante < 0) {
            await client.query('ROLLBACK');
            return res.status(409).json({
                success: false,
                message: `Stock insuficiente. Existencia actual: ${stockAnterior}`
            });
        }

        await client.query(
            `UPDATE producto SET stock_actual = $1 WHERE id_producto = $2`,
            [stockResultante, productoId]
        );

        const movimiento = await client.query(
            `INSERT INTO kardex
                (id_producto, tipo_movimiento, cantidad, stock_anterior,
                 stock_resultante, referencia, id_usuario)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            RETURNING *`,
            [
                productoId,
                `Ajuste ${tipoNormalizado.toLowerCase()}`,
                cantidadAjuste,
                stockAnterior,
                stockResultante,
                motivoLimpio,
                usuarioId
            ]
        );

        await client.query('COMMIT');

        res.status(201).json({
            success: true,
            message: 'Ajuste aplicado correctamente',
            movimiento: movimiento.rows[0]
        });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error(error);
        res.status(500).json({
            success: false,
            message: 'Error al realizar el ajuste de inventario'
        });
    } finally {
        client.release();
    }
});

app.get('/inventario/ajustes', async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT
                k.id_movimiento,
                k.fecha_movimiento,
                p.nombre AS producto,
                k.cantidad,
                k.referencia AS motivo,
                u.usuario
            FROM kardex k
            INNER JOIN producto p ON p.id_producto = k.id_producto
            INNER JOIN usuario u ON u.id_usuario = k.id_usuario
            WHERE k.tipo_movimiento = 'Ajuste salida'
            ORDER BY k.fecha_movimiento DESC, k.id_movimiento DESC
            LIMIT 100`
        );

        res.json(result.rows);
    } catch (error) {
        console.error(error);
        res.status(500).json({
            success: false,
            message: 'Error al consultar el historial de ajustes'
        });
    }
});

app.get('/inventario/kardex', async (req, res) => {
    try {
        const idProducto = Number(req.query.idProducto);
        const params = [];
        const filtros = [];

        if (Number.isInteger(idProducto) && idProducto > 0) {
            params.push(idProducto);
            filtros.push(`k.id_producto = $${params.length}`);
        }

        if (req.query.fechaInicio) {
            params.push(req.query.fechaInicio);
            filtros.push(`k.fecha_movimiento::date >= $${params.length}`);
        }

        if (req.query.fechaFin) {
            params.push(req.query.fechaFin);
            filtros.push(`k.fecha_movimiento::date <= $${params.length}`);
        }

        const result = await pool.query(
            `SELECT
                k.id_movimiento,
                k.fecha_movimiento,
                k.id_producto,
                p.codigo_barras,
                p.nombre AS producto,
                k.tipo_movimiento,
                k.cantidad,
                k.stock_anterior,
                k.stock_resultante,
                k.referencia,
                u.usuario
            FROM kardex k
            INNER JOIN producto p ON p.id_producto = k.id_producto
            INNER JOIN usuario u ON u.id_usuario = k.id_usuario
            ${filtros.length > 0 ? `WHERE ${filtros.join(' AND ')}` : ''}
            ORDER BY k.fecha_movimiento DESC, k.id_movimiento DESC
            LIMIT 200`,
            params
        );

        res.json(result.rows);
    } catch (error) {
        console.error(error);
        res.status(500).json({
            success: false,
            message: 'Error al consultar el Kardex'
        });
    }
});

app.get('/inventario/alertas', async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT
                id_producto,
                codigo_barras,
                nombre,
                stock_actual,
                stock_minimo,
                CASE
                    WHEN stock_actual <= 0 THEN 'Agotado'
                    ELSE 'Stock bajo'
                END AS alerta
            FROM producto
            WHERE stock_actual <= stock_minimo
            AND estado = 'Activo'
            ORDER BY stock_actual ASC, nombre`
        );

        res.json(result.rows);
    } catch (error) {
        console.error(error);
        res.status(500).json({
            success: false,
            message: 'Error al obtener las alertas de stock'
        });
    }
});

app.listen(PORT, () => {
    console.log(`Servidor corriendo en puerto ${PORT}`);
});
