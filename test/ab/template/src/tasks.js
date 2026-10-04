// In-memory task list used by the command-line entry point.
export function createTaskList() {
  const tasks = [];
  return {
    add(title) {
      if (!title || !title.trim()) throw new Error('title is required');
      const task = { id: tasks.length + 1, title: title.trim(), done: false };
      tasks.push(task);
      return task;
    },
    complete(id) {
      const task = tasks.find((item) => item.id === id);
      if (!task) throw new Error(`unknown task ${id}`);
      task.done = true;
      return task;
    },
    list() {
      return tasks.map((task) => ({ ...task }));
    },
  };
}
