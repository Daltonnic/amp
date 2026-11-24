import { describe, expect, it } from 'vitest'
import { avatarColor, avatarInitials, isNameComplete, publicName } from '@/lib/names'
import { roomFor } from '@/content/group'

const base = { first: 'David', last: 'Miller', nickname: '' }

describe('public names (must match public.public_name in SQL)', () => {
  it('formats each style', () => {
    expect(publicName({ ...base, style: 'first_last_initial' })).toBe('David M.')
    expect(publicName({ ...base, style: 'first' })).toBe('David')
    expect(publicName({ first: 'david', last: 'miller', nickname: '', style: 'initials' })).toBe('D.M.')
    expect(publicName({ ...base, first: ' David ', style: 'full' })).toBe('David Miller')
    expect(publicName({ ...base, last: '', style: 'full' })).toBe('David')
    expect(publicName({ ...base, last: '', style: 'first_last_initial' })).toBe('David')
    expect(publicName({ ...base, nickname: ' Steady ', style: 'nickname' })).toBe('Steady')
  })

  it('is empty when the chosen style has nothing to show', () => {
    expect(publicName({ ...base, style: 'nickname' })).toBe('')
    expect(publicName({ first: '', last: '', nickname: '', style: 'first_last_initial' })).toBe('')
  })

  it('requires a first name, and a nickname when that style is chosen', () => {
    expect(isNameComplete({ ...base, style: 'first_last_initial' })).toBe(true)
    expect(isNameComplete({ ...base, first: '  ', style: 'first_last_initial' })).toBe(false)
    expect(isNameComplete({ ...base, style: 'nickname' })).toBe(false)
    expect(isNameComplete({ ...base, nickname: 'Steady', style: 'nickname' })).toBe(true)
  })

  it('makes avatar initials and a steady color', () => {
    expect(avatarInitials('David M.')).toBe('DM')
    expect(avatarInitials('D.M.')).toBe('DM')
    expect(avatarInitials('steady')).toBe('S')
    expect(avatarColor('abc')).toBe(avatarColor('abc'))
  })
})

describe('group for each person (must match public.chat_room_for in SQL)', () => {
  it('splits by man or woman and by track', () => {
    expect(roomFor('men', 'man')).toBe('men-recovery')
    expect(roomFor('men', 'woman')).toBe('women-recovery')
    expect(roomFor('spouse', 'man')).toBe('men-betrayed')
    expect(roomFor('spouse', 'woman')).toBe('women-betrayed')
    expect(roomFor('men', null)).toBeNull()
  })
})
