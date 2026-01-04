import mongoose from 'mongoose';

const taskSchema = new mongoose.Schema({
    url: { type: String, required: true},
    keyword: { type: String, required: true},
    phoneNumber: { type: String, required: true},
    isActive: { type: Boolean, default: true},
    lastChecked: { type: Date, default: Date.now()}
});

const Task = mongoose.model('Task', taskSchema);

export default Task;