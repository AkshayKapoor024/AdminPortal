// Task routes: create/update/list/fetch/delete a task.
// Dependencies 

import express from 'express'

const router = express.Router()

import wrapAsync from '../utils/wrapAsync.js'

import { isAuthenticated,TaskValidate } from '../middlewares/middleware.js';

import { create, update, getAll, getSingle, remove } from '../controllers/tasks.js';

/**
 * @openapi
 * /api/tasks/create:
 *   post:
 *     summary: Create a new task
 *     description: |
 *       Creates a task owned by the currently logged-in admin user.
 *       `clientId` is stored as a plain string (no FK relation yet).
 *     tags: [Tasks]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/TaskCreateRequest' }
 *           example:
 *             title: "Follow up with HDFC AMC"
 *             description: "Discuss Q3 SIP onboarding"
 *             clientId: "CLT-00042"
 *             category: "Follow-up"
 *             priority: "high"
 *             status: "pending"
 *             dueDate: "2026-10-20T10:00:00.000Z"
 *     responses:
 *       200:
 *         description: Task created.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/TaskSingleResponse' }
 *             example:
 *               message: "Task generated for user Akshay Kapoor successfully"
 *               task: { id: "0192b3c4-...", title: "Follow up with HDFC AMC", status: "pending", priority: "high" }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       404:
 *         description: Logged-in user missing from DB.
 *         content:
 *           application/json:
 *             example: { error: "Cannot generate Task. Logged-in user not found." }
 *       500: { $ref: '#/components/responses/InternalError' }
 */

router.post('/create', isAuthenticated, TaskValidate, wrapAsync(create))

/**
 * @openapi
 * /api/tasks/update:
 *   patch:
 *     summary: Update an existing task
 *     description: |
 *       Only the task's owner can update it. Any user attempting to update
 *       another user's task receives a 403.
 *     tags: [Tasks]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/TaskUpdateRequest' }
 *           example:
 *             id: "0192b3c4-d5e6-7f89-a0b1-c2d3e4f5a6b8"
 *             title: "Follow up with HDFC AMC (rescheduled)"
 *             description: "Rescheduled to next week"
 *             clientId: "CLT-00042"
 *             category: "Follow-up"
 *             priority: "medium"
 *             status: "in_progress"
 *             dueDate: "2026-10-27T10:00:00.000Z"
 *     responses:
 *       200:
 *         description: Task updated.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/TaskSingleResponse' }
 *       400:
 *         description: Task ID not provided.
 *         content:
 *           application/json: { example: { error: "Task ID not provided" } }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403:
 *         description: Not the owner.
 *         content:
 *           application/json: { example: { error: "Not allowed to edit this task" } }
 *       404: { $ref: '#/components/responses/NotFound' }
 *       500: { $ref: '#/components/responses/InternalError' }
 */

router.patch('/update', isAuthenticated, TaskValidate, wrapAsync(update))

/**
 * @openapi
 * /api/tasks/getTasks:
 *   get:
 *     summary: List tasks owned by the logged-in user
 *     description: Returns only tasks where `userId` matches the current session. Ordered by `dueDate` ascending.
 *     tags: [Tasks]
 *     responses:
 *       200:
 *         description: Task list.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/TaskListResponse' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       500: { $ref: '#/components/responses/InternalError' }
 */

router.get('/getTasks', isAuthenticated, wrapAsync(getAll))

/**
 * @openapi
 * /api/tasks/task/{taskId}:
 *   get:
 *     summary: Fetch a single task by ID
 *     tags: [Tasks]
 *     parameters:
 *       - in: path
 *         name: taskId
 *         required: true
 *         schema: { type: string }
 *         example: "0192b3c4-d5e6-7f89-a0b1-c2d3e4f5a6b8"
 *     responses:
 *       200:
 *         description: Task fetched.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/TaskSingleResponse' }
 *       400:
 *         description: Task ID missing.
 *         content:
 *           application/json: { example: { error: "Task Id not provided" } }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403:
 *         description: Not the owner.
 *         content:
 *           application/json: { example: { error: "Not allowed to view this task" } }
 *       404: { $ref: '#/components/responses/NotFound' }
 *       500: { $ref: '#/components/responses/InternalError' }
 */

router.get('/task/:taskId', isAuthenticated, wrapAsync(getSingle))

/**
 * @openapi
 * /api/tasks/delete/{taskId}:
 *   delete:
 *     summary: Delete a task
 *     description: Only the owner can delete their task.
 *     tags: [Tasks]
 *     parameters:
 *       - in: path
 *         name: taskId
 *         required: true
 *         schema: { type: string }
 *         example: "0192b3c4-d5e6-7f89-a0b1-c2d3e4f5a6b8"
 *     responses:
 *       200:
 *         description: Task deleted.
 *         content:
 *           application/json: { example: { message: "Successfully deleted task" } }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403:
 *         description: Not the owner.
 *         content:
 *           application/json: { example: { error: "Not allowed to delete this task" } }
 *       404: { $ref: '#/components/responses/NotFound' }
 *       500: { $ref: '#/components/responses/InternalError' }
 */

router.delete('/delete/:taskId', isAuthenticated, wrapAsync(remove))

export default router