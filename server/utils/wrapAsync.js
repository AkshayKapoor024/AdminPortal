/**
 * Wrap an async Express route handler so its errors reach Express.
 *
 * Express does not automatically catch a rejected Promise thrown inside
 * an `async (req, res) => {}` route handler. Wrapping the handler with
 * `wrapAsync(fn)` catches any such rejection and forwards it to
 * `next(err)`, so it ends up in the normal Express error-handling
 * middleware instead of crashing the server or hanging the request.
 */
function wrapAsync(fn){
    return function(req,res,next){
        fn(req,res,next).catch(err=>next(err))
    }
}
export default wrapAsync
