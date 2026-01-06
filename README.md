# Leé.Io

Una aplicación web minimalista para leer y hacer anotaciones en documentos PDF.

## Características

- **Interfaz Minimalista**: Diseño limpio en blanco y negro.
- **Modo Día/Noche**: Cambia el tema según tu preferencia y el sistema recordará tu elección.
- **Visualización de PDF**: Carga archivos PDF desde tu dispositivo.
- **Anotaciones**: Agrega notas a páginas específicas que se guardan automáticamente en tu navegador.
- **Animaciones**: Transiciones suaves y título animado.

## Tecnologías

- React
- Vite
- Tailwind CSS
- Framer Motion
- React PDF

## Cómo usar localmente

1. Instalar dependencias:
   ```bash
   npm install
   ```

2. Iniciar servidor de desarrollo:
   ```bash
   npm run dev
   ```

## Cómo desplegar en GitHub Pages

Para subir esta página a GitHub "sin ningún problema", sigue estos pasos:

1. Ejecuta el comando de construcción:
   ```bash
   npm run build
   ```

2. Esto creará una carpeta llamada `dist`.

3. Sube el contenido de la carpeta `dist` a tu repositorio de GitHub.

4. Configura GitHub Pages en la configuración del repositorio para servir desde la rama/carpeta donde subiste los archivos.

Alternativamente, si subes todo el código fuente, puedes configurar una GitHub Action para construir y desplegar automáticamente.
