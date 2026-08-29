/**
 * Turn a date into a friendly, human-readable label.
 *
 * Used for both task due-dates and lead follow-up dates, this compares
 * the given date to "today" (with the time portion ignored, so only the
 * calendar day matters) and returns:
 *   - "Expired"   if the date is in the past
 *   - "Today"     if the date is today
 *   - "Tomorrow"  if the date is tomorrow
 *   - otherwise, a short "DD Mon" formatted date (e.g. "05 Mar")
 *
 * @param {string|Date} date
 * @returns {string} the label to display in the UI
 */
function getDateLabel(date) {
    const target = new Date(date)

    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)

    target.setHours(0, 0, 0, 0)

    if (target < today) {
        return 'Expired'
    }

    if (target.getTime() === today.getTime()) {
        return 'Today'
    }

    if (target.getTime() === tomorrow.getTime()) {
        return 'Tomorrow'
    }

    return target.toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short'
    })
    
}

module.exports = getDateLabel
