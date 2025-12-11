function InventoryCharts({ items }) {
  // Data: quantity per item
  const perItem = items.map((i) => ({
    name: i.name,
    quantity: i.quantity || 0,
  }));

  // Data: quantity per category
  const perCategoryMap = new Map();
  items.forEach((i) => {
    const key = i.category || "Uncategorized";
    const prev = perCategoryMap.get(key) || 0;
    perCategoryMap.set(key, prev + (i.quantity || 0));
  });
  const perCategory = Array.from(perCategoryMap.entries()).map(
    ([name, quantity]) => ({ name, quantity })
  );

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
      <div style={styles.chartCard}>
        <div style={styles.chartTitle}>Stock by Item</div>
        <ResponsiveContainer width="100%" height={250}>
          <BarChart data={perItem}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" hide />
            <YAxis />
            <Tooltip />
            <Bar dataKey="quantity" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div style={styles.chartCard}>
        <div style={styles.chartTitle}>Stock by Category</div>
        <ResponsiveContainer width="100%" height={250}>
          <BarChart data={perCategory}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" />
            <YAxis />
            <Tooltip />
            <Bar dataKey="quantity" />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
