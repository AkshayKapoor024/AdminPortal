/**
 * A small custom Error class used across the whole app.
 *
 * Instead of throwing a plain `Error`, controllers and services throw
 * `new customError(statusCode, message)`. This lets a single Express
 * error-handling middleware read `error.status` and respond with the
 * correct HTTP status code (400, 404, 500, etc.) and the given message,
 * instead of every route having to build that response by hand.
 */
class customError extends Error{
    constructor(status,message){
        super(message)
        this.status=status
    }
}
export default customError
