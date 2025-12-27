// W2M - Categories HTML Template

export function getCategoriesHTML(categories: any[]): string {
  if (categories.length === 0) {
    return '<p class="text-gray-500">No hay categorías configuradas</p>';
  }

  return `
    <ul class="space-y-2">
      ${categories.map(category => {
        // Escapar valores para uso seguro en atributos HTML
        const escapedName = category.name.replace(/'/g, "\\'").replace(/"/g, '&quot;');
        const escapedSeparator = (category.separator || ',,').replace(/'/g, "\\'").replace(/"/g, '&quot;');
        // Usar Base64 para pasar el array de fields de forma segura
        const fieldsBase64 = Buffer.from(JSON.stringify(category.enabledFields)).toString('base64');
        
        return `
        <li class="flex items-center justify-between p-3 bg-gray-50 rounded">
          <div class="flex-1">
            <span class="font-medium">${category.name}</span>
            ${category.description ? `<p class="text-sm text-gray-500 mt-1">${category.description}</p>` : ''}
            <p class="text-xs text-gray-400 mt-1">Campos: ${category.enabledFields.join(', ')} | Separador: <code class="bg-gray-200 px-1 rounded">${category.separator || ',,'}</code></p>
          </div>
          <div class="flex gap-2">
            <button 
              onclick="viewCategoryMarkdown('${escapedName}')"
              class="text-green-500 hover:text-green-700 px-2 py-1 rounded text-sm"
            >
              Ver
            </button>
            <button 
              data-category="${escapedName}"
              data-fields="${fieldsBase64}"
              data-separator="${escapedSeparator}"
              onclick="openConfigureFieldsModalFromButton(this)"
              class="text-blue-500 hover:text-blue-700 px-2 py-1 rounded text-sm"
            >
              Configurar
            </button>
            <button 
              onclick="deleteCategory('${escapedName}')"
              class="text-red-500 hover:text-red-700 px-2 py-1 rounded text-sm"
            >
              Eliminar
            </button>
          </div>
        </li>
      `}).join('')}
    </ul>
  `;
}
