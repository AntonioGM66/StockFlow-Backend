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
        res.status(500).send('Error al obtener marcas');
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

app.listen(PORT, () => {
    console.log(`Servidor corriendo en puerto ${PORT}`);
});