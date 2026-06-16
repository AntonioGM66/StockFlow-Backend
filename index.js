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
        const { nombre, precio, stock } = req.body;

        const result = await pool.query(
            'INSERT INTO productos (nombre, precio, stock) VALUES ($1, $2, $3) RETURNING *',
            [nombre, precio, stock]
        );

        res.json(result.rows[0]);
    } catch (error) {
        console.error(error);
        res.status(500).send('Error al insertar producto');
    }
});

// Ver productos
app.get('/productos', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM productos');
        res.json(result.rows);
    } catch (error) {
        console.error(error);
        res.status(500).send('Error al obtener productos');
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

app.listen(PORT, () => {
    console.log(`Servidor corriendo en puerto ${PORT}`);
});