const { Sequelize, DataTypes } = require('sequelize');
const dotenv = require('dotenv');

dotenv.config();

const sequelize = new Sequelize(
    process.env.DB_NAME,
    process.env.DB_USER,
    process.env.DB_PASS,
    {
        host: process.env.DB_HOST,
        dialect: 'mysql',
        logging: false
    }
);

const User = sequelize.define('User', {
    name: {
        type: DataTypes.STRING,
        allowNull: false
    },
    email: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true
    },
    password: {
        type: DataTypes.STRING,
        allowNull: false
    },
    role: {
        type: DataTypes.ENUM('admin', 'customer'),
        defaultValue: 'customer'
    }
});

async function fixAdminRole() {
    try {
        await sequelize.authenticate();
        console.log('Database connected.');

        const adminEmail = process.env.ADMIN_EMAIL || 'Mazenelfar2006@gmail.com';
        const user = await User.findOne({ where: { email: adminEmail } });

        if (user) {
            console.log(`Found user: ${user.email} with role: ${user.role}`);
            if (user.role !== 'admin') {
                console.log('Updating role to admin...');
                user.role = 'admin';
                await user.save();
                console.log('User role updated successfully.');
            } else {
                console.log('User is already an admin.');
            }
        } else {
            console.log('Admin user not found!');
        }

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await sequelize.close();
    }
}

fixAdminRole();
