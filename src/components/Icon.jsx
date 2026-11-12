const PATHS = {
  home: ['M3 11l9-7 9 7', 'M5 10v10h14V10'],
  words: ['M4 5a2 2 0 012-2h14v16H6a2 2 0 00-2 2z', 'M4 21a2 2 0 002 2h14v-4'],
  expressions: ['M7 7h4v6a3 3 0 01-3 3', 'M15 7h4v6a3 3 0 01-3 3'],
  chats: ['M4 5h16v11H9l-5 4z'],
  journal: ['M4 20l1-4L16 5l3 3L8 19z'],
  profile: ['M12 12a4 4 0 100-8 4 4 0 000 8z', 'M4 21c1-4 4-6 8-6s7 2 8 6'],
}

export default function Icon({ name, size = 20 }) {
  return (
    <svg
      aria-hidden="true"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {PATHS[name].map((path) => (
        <path key={path} d={path} />
      ))}
    </svg>
  )
}
