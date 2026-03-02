# SillyTavern Avatar Replacement

Add an endpoint to replace the avatar of a character.

## Installation

1. **Enable Plugins in SillyTavern**
   Open `config.yaml` in your main SillyTavern directory and set:

    ```yaml
    enableServerPlugins: true
    ```

2. **Clone the Repository**
   Navigate to the `plugins` folder and clone the project:

    ```bash
    cd plugins
    git clone https://github.com/Nidelon/SillyTavern-AvatarEdit
    ```

## Usage
```
/api/plugins/avataredit/edit-avatar
OR
/api/plugins/avataredit/edit-avatar?crop={cropdata}

FORMDATA
{
    'avatar': FILE,
    'avatar_url': 'default_FluxTheCat.png'
}
-> Code 200
```

## License

MIT
