import { num } from './format.js'

/**
 * Money rules that must hold everywhere a booking is created or edited.
 * Kept in a plain .js module (no JSX) so both the form layer and the
 * node test suite can import them without a JSX loader.
 */

/** Remaining balance on a booking. Negative means the customer overpaid. */
export const dueOnBooking = (values) => num(values?.totalAmount) - num(values?.bookingAmount)

/**
 * Returns an error message when the booking is not payable as entered,
 * otherwise null. Enforced in the form AND in the database layer.
 */
export const validateBookingAmounts = (values) => {
  const total = num(values?.totalAmount)
  const booking = num(values?.bookingAmount)
  if (total <= 0 || booking <= 0) return null
  if (booking > total) {
    return `Booking Amount cannot be more than the Total Amount (${total}).`
  }
  return null
}