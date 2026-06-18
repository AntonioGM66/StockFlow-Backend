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

app.listen(PORT, () => {
    console.log(`Servidor corriendo en puerto ${PORT}`);
});
