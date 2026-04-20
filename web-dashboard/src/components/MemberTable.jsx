function statusClass(status) {
  return status.toLowerCase();
}

export default function MemberTable({ members }) {
  return (
    <section className="card table-panel">
      <header>
        <h3>Bridge Member Condition</h3>
        <p>Calculated from simulated strain + stress distribution</p>
      </header>
      <table>
        <thead>
          <tr>
            <th>Member</th>
            <th>Condition Score</th>
            <th>Status</th>
            <th>Stress (MPa)</th>
            <th>Deflection (mm)</th>
          </tr>
        </thead>
        <tbody>
          {members.map((member) => (
            <tr key={member.member}>
              <td>{member.member}</td>
              <td>{member.conditionScore}</td>
              <td>
                <span className={`status-pill ${statusClass(member.status)}`}>{member.status}</span>
              </td>
              <td>{member.stress}</td>
              <td>{member.deflection}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
