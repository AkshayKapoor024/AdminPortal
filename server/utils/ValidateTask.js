/**
 * Joi validation schema for a "Task" record.
 *
 * Used by `middlewares/middleware.js` (`TaskValidate`) to check the
 * request body before a task is created or updated.
 */
// utils/ValidateTask.js
import Joi from "joi";

export default Joi.object({
  title: Joi.string().required(),
  description: Joi.string().allow("").optional(),
  clientId: Joi.string().required(),     // plain string, mock for now
  category: Joi.string().required(),
  priority: Joi.string().valid("High", "Medium", "Low").required(),
  status: Joi.string().valid("Open", "In progress", "Closed").required(),
  dueDate: Joi.date().required(),
  id: Joi.string().optional(),
  // userId NOT accepted from frontend
});