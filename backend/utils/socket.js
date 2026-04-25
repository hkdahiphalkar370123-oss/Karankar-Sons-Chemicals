const { Server } = require('socket.io');

let io;

const initSocket = (server) => {
    io = new Server(server, {
        cors: {
            origin: [
                'http://localhost:3000',
                'http://localhost:5000',
                'http://127.0.0.1:5000',
                process.env.FRONTEND_URL || 'http://localhost:3000'
            ],
            methods: ['GET', 'POST'],
            credentials: true
        }
    });

    io.on('connection', (socket) => {
        console.log(`🔌 New client connected: ${socket.id}`);

        // Join specific rooms based on companyId or userId if needed
        socket.on('join', (room) => {
            socket.join(room);
            console.log(`👤 Socket ${socket.id} joined room: ${room}`);
        });

        socket.on('disconnect', () => {
            console.log(`🔌 Client disconnected: ${socket.id}`);
        });
    });

    return io;
};

const getIO = () => {
    if (!io) {
        throw new Error('Socket.io not initialized!');
    }
    return io;
};

const emitEvent = (event, data, room = null) => {
    if (!io) return;
    
    if (room) {
        io.to(room).emit(event, data);
    } else {
        io.emit(event, data);
    }
};

module.exports = { initSocket, getIO, emitEvent };
