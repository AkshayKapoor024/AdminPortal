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